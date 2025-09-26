import { Server as HttpServer} from "node:http";
import { Server } from "socket.io";
import { decodeToken, TokenEnum } from "../../utils/security/token.security";
import { IAuthSocket } from "./gateway.interface";
import { ChatGateway } from "../chat";
import { BadRequestException } from "../../utils/response/error.response";

export const connectedSockets = new Map<string,string[]>();
let io: undefined | Server = undefined;

export const initializeIo = (httpServer: HttpServer) => {

    const io = new Server(httpServer,{
        cors: {
            origin: "*"
        }
    });

    io.use(async(socket: IAuthSocket, next)=>{
        try {
            const {user, decoded} =  await decodeToken({
                authorization: socket.handshake?.auth.authorization || "",
                tokenType: TokenEnum.access
            });
            
            const userTabs = connectedSockets.get(user._id.toString()) || [];
            userTabs.push(socket.id);
            connectedSockets.set(user._id.toString(),userTabs);
            socket.credentials = {user, decoded};
            next();
        } catch (error: any) {
            next(error)
        }
    });


    function disconnect(socket: IAuthSocket, io: Server)
    {
        return socket.on("disconnect",()=>{
            const userId = socket.credentials?.user._id?.toString() as string;
            let remainingTabs = connectedSockets.get(userId)?.filter((tab:string) => {
                return tab !== socket.id;
            }) || [];

            if(remainingTabs.length)
            {
                connectedSockets.set(userId, remainingTabs);
            }
            else
            {
                connectedSockets.delete(userId);
                io.emit("offline_user",userId);
            }
        })
    }

    const chatGateway: ChatGateway = new ChatGateway();
    io.on("connection",(socket: IAuthSocket)=>{
        
        const userId = socket.credentials?.user._id?.toString() as string;
        io.emit("online_user",userId);
        chatGateway.register(socket,getIo());
        disconnect(socket, io);
    });

}

export const getIo = (): Server => {
    if(!io) throw new BadRequestException("Failed to establish server socket io");
    return io;
}