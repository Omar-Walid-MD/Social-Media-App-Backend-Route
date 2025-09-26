import type { Request, Response } from "express";
import { successResponse } from "../../utils/response/success.response";
import { ICreateChattingGroupBodyDTO, IGetChatParamsDTO, IGetChatQueryDTO, IGetChattingGroupParamsDTO, IGetChattingGroupQueryDTO, IJoinRoomDTO, ISayHiDTO, ISendGroupMessageDTO, ISendMessageDTO, ISetTypingDTO } from "./chat.dto";
import { ChatRepository, UserRepository } from "../../db/repository";
import { ChatModel, UserModel } from "../../db/models";
import { Types } from "mongoose";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";
import { IGetChatResponse } from "./chat.entities";
import { connectedSockets, getIo } from "../gateway";
import { deleteFile, uploadFile } from "../../utils/multer/s3.config";
import {v4 as uuid} from "uuid";


export class ChatService
{
    private userModel = new UserRepository(UserModel);
    private chatModel = new ChatRepository(ChatModel);
    constructor(){}

    //REST
    getChat = async(req:Request, res: Response): Promise<Response> => {
        
        const {userId} = req.params as IGetChatParamsDTO;
        const {page, size} = req.query as IGetChatQueryDTO;

        const chat = await this.chatModel.findOneChat({
            filter: {
                participants: {
                    $all: [
                        req.user?._id as Types.ObjectId,
                        Types.ObjectId.createFromHexString(userId)
                    ]
                },
                group: {$exists: false}
            },
            options: {
                populate: [{
                    path: "participants",
                    select: "firstName lastName email gender profilePicture"
                }]
            },
            page,
            size
        });

        if(!chat) throw new BadRequestException("Failed to find matching chat instance");
        return successResponse<IGetChatResponse>({res,data:{chat}});
    }

    getChattingGroup = async(req:Request, res: Response): Promise<Response> => {
        
        const {groupId} = req.params as IGetChattingGroupParamsDTO;
        const {page, size} = req.query as IGetChattingGroupQueryDTO;

        const chat = await this.chatModel.findOneChat({
            filter: {
                _id: Types.ObjectId.createFromHexString(groupId),
                participants: {$in: req.user?._id as Types.ObjectId},
                group: {$exists: true}
            },
            options: {
                populate: [{
                    path: "messages.createdBy",
                    select: "firstName lastName email gender profilePicture"
                }]
            },
            page,
            size
        });

        if(!chat) throw new BadRequestException("Failed to find matching chat instance");
        return successResponse<IGetChatResponse>({res,data:{chat}});
    }

    createChattingGroup = async(req:Request, res: Response): Promise<Response> => {
        
        const {group, participants} = req.body as ICreateChattingGroupBodyDTO;
        const dbParticipants = participants.map((participant)=>Types.ObjectId.createFromHexString(participant));
        const users = await this.userModel.find({
            filter: {
                _id: {$in: participants},
                friends: {$in: req.user?._id as Types.ObjectId}
            }
        });

        if(participants.length !== users.length)
        {
            throw new NotFoundException("Some or all recipients are invalid");
        }

        let groupImage: string | undefined = undefined;
        const roomId = group.replaceAll(/\s+/g,"_")+"_"+uuid()
        if(req.file)
        {
            groupImage = await uploadFile({
                file:req.file as Express.Multer.File,
                path: `chat/${roomId}`
            });
        }

        dbParticipants.push(req.user?._id as Types.ObjectId);

        const [chat] = await this.chatModel.create({
            data: [{
                createdBy: req.user?._id as Types.ObjectId,
                group,
                roomId,
                groupImage: groupImage as string,
                messages: [],
                participants: dbParticipants
            }]
        }) || [];

        if(!chat)
        {
            if(groupImage)
            {
                await deleteFile({Key: groupImage});
            }
            throw new BadRequestException("Fail to generate this group");
        }

        return successResponse<IGetChatResponse>({res,statusCode:201,data:{chat}});
    }

    //IO
    sayHi = ({message, socket, callback, io}: ISayHiDTO) => {
        try {
            console.log({message});
            if(callback)
            {
                callback("Hello BE to FE");
            }
        } catch (error) {
            socket.emit("custom_error",error);
        }
    }

    //send OVO Message
    sendMessage = async({content, sendTo, socket, io}: ISendMessageDTO) => {
        try {
            const createdBy = socket.credentials?.user._id as Types.ObjectId;
        
            const user = await this.userModel.findOne({
                filter: {
                    _id: Types.ObjectId.createFromHexString(sendTo),
                    friends:{$in: createdBy}
                }
            });

            if(!user) throw new NotFoundException("Invalid recipient friend");

            const chat = await this.chatModel.findOneAndUpdate({
                filter: {
                    participants: {
                        $all: [
                            createdBy as Types.ObjectId,
                            Types.ObjectId.createFromHexString(sendTo)
                        ]
                    },
                    group: {$exists: false}
                },
                update: {
                    $addToSet: {messages: {content,createdBy}}
                }
            });

            if(!chat)
            {
                const [newChat] = await this.chatModel.create({
                    data: [{
                        createdBy,
                        messages: [{content,createdBy}],
                        participants: [
                            createdBy as Types.ObjectId,
                            Types.ObjectId.createFromHexString(sendTo)
                        ]
                    }]
                }) || [];

                if(!newChat) throw new BadRequestException("Failed to create this chat instance");
            }

            const io = getIo();
            io.to(connectedSockets.get(createdBy.toString() as string) as string[]).emit("successMessage",{content});
            io.to(connectedSockets.get(sendTo) as string[]).emit("newMessage",{content, from: socket.credentials?.user});

        } catch (error) {
            socket.emit("custom_error",error);
        }
    }

    joinRoom = async({roomId, socket, io}: IJoinRoomDTO) => {
        try {
            const chat = await this.chatModel.findOne({
                filter: {
                    roomId,
                    group: {$exists: true},
                    participants: {$in: socket.credentials?.user._id}
                }
            });

            if(!chat) throw new NotFoundException("Failed to find matching room");

            socket.join(chat.roomId as string);

        } catch (error) {
            socket.emit("custom_error",error);
        }
    }

    //send OVM Message
    sendGroupMessage = async({content, groupId, socket, io}: ISendGroupMessageDTO) => {
        try {

            const createdBy = socket.credentials?.user._id as Types.ObjectId;
            
            const chat = await this.chatModel.findOneAndUpdate({
                filter: {
                    _id: Types.ObjectId.createFromHexString(groupId),
                    participants: {$in: createdBy as Types.ObjectId},
                    group: {$exists: true}
                },
                update: {
                    $addToSet: {messages: {content,createdBy}}
                }
            });

            if(!chat)
            {
                throw new BadRequestException("Failed to create this chat instance");
            }

            const io = getIo();
            io.to(connectedSockets.get(createdBy.toString() as string) as string[]).emit("successMessage",{content});
            socket.to(chat.roomId as string).emit("newMessage",{content, from: socket.credentials?.user, groupId});

        } catch (error) {
            socket.emit("custom_error",error);
        }
    }

    //set typing
    setTyping = async({typing, groupId, sendTo, socket, io}: ISetTypingDTO) => {
        try {

            const userId = socket.credentials?.user._id as Types.ObjectId;

            const io = getIo();

            if(sendTo)
            {
                io.to(connectedSockets.get(sendTo as string) as string[]).emit("setTyping",{typing, user: socket.credentials?.user});
            }
            else if(groupId)
            {
                const chat = await this.chatModel.findOne({
                    filter: {
                        _id: Types.ObjectId.createFromHexString(groupId),
                        participants: {$in: userId as Types.ObjectId},
                        group: {$exists: true}
                    }
                });
                if(chat)
                {
                    io.to(chat.roomId as string).emit("setTyping",{typing, user: socket.credentials?.user, groupId});
                }
                else
                {
                    throw new NotFoundException("Failed to find matching chatting group");
                }
            }

        } catch (error) {
            socket.emit("custom_error",error);
        }
    }

}
