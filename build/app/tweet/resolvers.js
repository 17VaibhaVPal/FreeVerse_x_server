"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const db_1 = require("../../client/db");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const user_1 = __importDefault(require("../../services/user"));
const tweet_1 = __importDefault(require("../../services/tweet"));
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_DEFAULT_REGION,
});
const queries = {
    getAllTweets: () => tweet_1.default.getAllTweets(),
    getSignedURLForTweet: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { imageType, imageName }, ctx) {
        var _b;
        if (!((_b = ctx.user) === null || _b === void 0 ? void 0 : _b.id))
            throw new Error("Unauthorised");
        const allowedImageType = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
        ];
        if (!allowedImageType.includes(imageType))
            throw new Error("Unsupported image type");
        const fileExtension = imageType.split("/")[1];
        const putObjectCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: `upload/${ctx.user.id}/tweets/${imageName}-${Date.now()}.${fileExtension}`,
            ContentType: imageType,
        });
        const signedURL = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, putObjectCommand);
        return signedURL;
    }),
    // ✅ NEW: Fetch comments for a tweet
    getComments: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { tweetId }, ctx) {
        return yield db_1.prismaClient.comment.findMany({
            where: { tweetId },
            include: { user: true },
            orderBy: { createdAt: "asc" },
        });
    }),
};
const mutations = {
    createTweet: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { payload }, ctx) {
        if (!ctx.user)
            throw new Error("You are not authenticated");
        const tweet = yield tweet_1.default.createTweet(Object.assign(Object.assign({}, payload), { userId: ctx.user.id }));
        return tweet;
    }),
    // ✅ NEW: Create a comment
    createComment: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { tweetId, content }, ctx) {
        if (!ctx.user)
            throw new Error("You are not authenticated");
        const comment = yield db_1.prismaClient.comment.create({
            data: {
                tweetId,
                content,
                userId: ctx.user.id,
            },
            include: { user: true },
        });
        return comment;
    }),
};
//as earlier there was no resolver for this "author" , so create extra resolver
const extraResolvers = {
    Tweet: {
        //so for  a Tweet if u r asking m for an author , Tweet is the parent
        author: (parent) => user_1.default.getUserById(parent.authorId),
        //so basically u r finding the user from the tweet's authorId
        isBookmarked: (parent, _args, ctx) => __awaiter(void 0, void 0, void 0, function* () {
            if (!ctx.user)
                return false;
            const existingBookmark = yield db_1.prismaClient.bookmark.findFirst({
                where: {
                    userId: ctx.user.id,
                    tweetId: parent.id,
                },
            });
            return !!existingBookmark;
        }),
        commentsCount: (parent) => __awaiter(void 0, void 0, void 0, function* () {
            return yield db_1.prismaClient.comment.count({
                where: { tweetId: parent.id },
            });
        }),
        // ✅ Get list of comments
        comments: (parent) => __awaiter(void 0, void 0, void 0, function* () {
            return yield db_1.prismaClient.comment.findMany({
                where: { tweetId: parent.id },
                include: { user: true },
                orderBy: { createdAt: "asc" },
            });
        }),
    },
};
exports.resolvers = { mutations, queries, extraResolvers };
