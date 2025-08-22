import type {Model} from "mongoose";

type FindParamsType = {
    model: Model<any>;
    filter: any;
    select?: string;
    populate?: any[];
}



export const findOne = async({
        model,
        filter={},
        select="",
        populate=[]
    }: FindParamsType
    ) => {
    return await model.findOne(filter).select(select).populate(populate);
}

export const findById = async({
        model,
        id,
        select="",
        populate=[]
    }:
    {
        model: Model<any>;
        id: string;
        select?: string;
        populate?: any[];
    }) => {
    return await model.findById(id).select(select).populate(populate);
}

export const find = async({
        model,
        filter={},
        select="",
        populate=[]
    }: FindParamsType) => {
    return await model.find(filter).select(select).populate(populate);
}

export const create = async({
        model,
        data={},
        options={validateBeforeSave:true}
    }:
    {
        model: Model<any>;
        data: any;
        options?: any;
    }
) => {
    return await model.create(data,options);
}

export const updateOne = async({
        model,
        filter={},
        update={},
        options = {runValidators:true}
    }:
    {
        model: Model<any>;
        filter: any;
        update: any;
        options?: any;
    }
) => {
    return await model.updateOne(filter,update,options);
}

export const findOneAndUpdate = async({
        model,
        filter={},
        update={},
        select="",
        populate=[],
        options = {runValidators:true,new:true}
    }:
    {
        model: Model<any>;
        filter: any;
        update: any;
        select?: string;
        populate?: any[];
        options?: any;
    }
) => {
    return await model.findOneAndUpdate(filter,{
        ...update,
        $inc: {__v:1}
    },options).select(select).populate(populate);
}

export const deleteOne = async({
        model,
        filter={}
    }:
    {
        model: Model<any>,
        filter: any
    }
) => {
    return await model.deleteOne(filter);
}

export const deleteMany = async({
        model,
        filter={}
    }:
    {
        model: Model<any>,
        filter: any
    }
) => {
    return await model.deleteMany(filter);
}