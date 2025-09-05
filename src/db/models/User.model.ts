import { model, models, Schema, HydratedDocument } from "mongoose";

export enum GenderEnum {
    male="male",
    female="female"
}

export enum RoleEnum {
    user="user",
    admin="admin"
}

export enum ProviderEnum {
    system="system",
    google="google"
}

export interface IUser {

    firstName: string;
    lastName: string;
    username?: string;

    email: string;
    confirmEmailOtp?: string;
    confirmedAt: Date;

    password: string;
    resetPasswordOtp?: string;
    changeCredentialsTime?: Date;

    phone?: string;
    address?: string;
    profilePicture?: string;
    tempProfilePicture?: string;
    coverImages?: string[];

    gender: GenderEnum;
    role: RoleEnum;
    provider: ProviderEnum;

    createdAt: Date;
    updatedAt?: Date;

    freezedAt?: Date;
    freezedBy?: Schema.Types.ObjectId;

    restoredAt?: Date;
    restoredBy?: Schema.Types.ObjectId;
}

const userSchema = new Schema<IUser>({


    firstName: {type:String, required: true, minlength: 2, maxlength: 25},
    lastName: {type:String, required: true, minlength: 2, maxlength: 25},

    email: {type:String, required: true, unique: true},
    confirmEmailOtp: {type: String},
    confirmedAt: {type: Date},

    password: {type: String, required: function(){
        return this.provider !== ProviderEnum.google
    }},
    resetPasswordOtp: {type: String},
    changeCredentialsTime: {type: Date},

    phone: {type: String},
    address: {type: String},

    profilePicture: {type: String},
    tempProfilePicture: {type: String},
    coverImages: [String],
    gender: {type: String, enum:GenderEnum, default: GenderEnum.male},
    role: {type: String, enum:RoleEnum, default: RoleEnum.user},
    provider: {type: String, enum:ProviderEnum, default: ProviderEnum.system},

    freezedAt: {type: Date},
    freezedBy: {type: Schema.Types.ObjectId, ref: "User"},

    restoredAt: {type: Date},
    restoredBy: {type: Schema.Types.ObjectId, ref: "User"},


},{
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

userSchema.virtual("username")
.set(function (value: string) {
    const [firstName, lastName] = value.split(" ") || [];
    this.set({firstName, lastName});
})
.get(function() {
    return this.firstName + " " + this.lastName;
});

export const UserModel = models.User || model<IUser>("User",userSchema);
export type HUserDocument = HydratedDocument<IUser>;