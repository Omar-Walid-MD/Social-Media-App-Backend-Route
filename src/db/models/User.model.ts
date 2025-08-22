import mongoose from "mongoose";

export const genderEnum = {male:"male",female:"female"};
export const roleEnum = {user:"user",admin:"admin"};
export const providerEnum = {system:"system",google:"google"}

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        minLength: 2,
        maxLength: [20,"firstName max length is 20 character. You have entered {VALUE}."]
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: function() {
            return (this as any).provider === providerEnum.system;
        }
    },
    confirmEmail: Date,
    confirmEmailOtp: new mongoose.Schema({
        otp: String,
        expirationDate: Number,
        attempts: Number,
        retryDate: Number
    }),
},{
    timestamps: true,
    toObject: {virtuals:true},
    toJSON: {virtuals:true}
});


export const UserModel = mongoose.models.user || mongoose.model("user",userSchema);

UserModel.syncIndexes();