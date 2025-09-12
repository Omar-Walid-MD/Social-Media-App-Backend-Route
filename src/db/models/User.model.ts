import { model, models, Schema, HydratedDocument } from "mongoose";
import { UpdateQuery } from "mongoose";

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
    slug?: string;

    email: string;
    confirmEmailOtp?: string;
    confirmedAt: Date;

    password: string;
    resetPasswordOtp?: string;
    updateEmailOtp?: string;
    loginOtp?: string;
    enableVerificationOtp?: string;
    changeCredentialsTime?: Date;

    twoStepVerification?: Boolean;

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
    slug: {type:String, required: true, minlength: 5, maxlength: 51},

    email: {type:String, required: true, unique: true},
    confirmEmailOtp: {type: String},
    confirmedAt: {type: Date},

    password: {type: String, required: function(){
        return this.provider !== ProviderEnum.google
    }},
    resetPasswordOtp: {type: String},
    changeCredentialsTime: {type: Date},
    twoStepVerification: {type: Boolean},

    updateEmailOtp: {type: String},
    enableVerificationOtp: {type: String},
    loginOtp: {type: String},
    

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
    toObject: {virtuals: true},
    strictQuery:true
});

export type HUserDocument = HydratedDocument<IUser>;

userSchema.virtual("username")
.set(function (value: string) {
    const [firstName, lastName] = value.split(" ") || [];
    this.set({firstName, lastName, slug: value.replaceAll(/\s+/g,"-")});
})
.get(function() {
    return this.firstName + " " + this.lastName;
});

userSchema.pre(["find","findOne"],function(next)
{
    const query = this.getQuery();
    if(query.paranoid === false)
    {
        this.setQuery({...query});
    }
    else
    {
        this.setQuery({...query,freezedAt: {$exists:false}});
    }

    next();
});

userSchema.pre(["findOneAndUpdate","updateOne"], async function(next)
{
    const update = this.getUpdate() as UpdateQuery<HUserDocument>;

    if(update.freezedAt)
    {
        this.setUpdate({...update, changeCredentialsTime: new Date()});
    }
});

// userSchema.post(["findOneAndUpdate","updateOne"], async function(next)
// {
//     const query = this.getQuery();
//     const update = this.getUpdate() as UpdateQuery<HUserDocument>;

//     if(update["$set"].changeCredentialsTime)
//     {
//         const tokenModel = new TokenRepository(TokenModel);
//         await tokenModel.deleteMany({filter:{userId:query._id}});
//     }
// });

// userSchema.post(["deleteOne", "findOneAndDelete"],async function(doc, next)
// {
//     const query = this.getQuery();
//     console.log(this);
//     const tokenModel = new TokenRepository(TokenModel);
//     await tokenModel.deleteMany({filter:{userId:query._id}});
// });

// userSchema.pre("insertMany",async function(next,docs)
// {
//     console.log(this,docs);
//     for (const doc of docs) {
//         doc.password = await generateHash(doc.password);
//     }
// })

export const UserModel = models.User || model<IUser>("User",userSchema);
