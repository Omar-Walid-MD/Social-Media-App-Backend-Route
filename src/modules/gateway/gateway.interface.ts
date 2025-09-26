import { JwtPayload } from "jsonwebtoken";
import { HUserDocument } from "../../db/models/User.model";
import { Server, Socket } from "socket.io";

export interface IAuthSocket extends Socket {
    credentials?: {
        user: Partial<HUserDocument>;
        decoded: JwtPayload;
    }
}

export interface IMainDTO {
    socket: IAuthSocket;
    callback?: any;
    io?: Server;
}