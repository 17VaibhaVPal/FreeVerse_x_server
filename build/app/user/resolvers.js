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
const jwt_1 = __importDefault(require("../../services/jwt"));
const user_1 = __importDefault(require("../../services/user"));
const redis_1 = require("../../client/redis");
const bcrypt_1 = __importDefault(require("bcrypt"));
const queries = {
    getConversations: (_, __, ctx) => __awaiter(void 0, void 0, void 0, function* () {
        if (!ctx.user)
            throw new Error("Unauthenticated");
        const userId = ctx.user.id;
        const sentTo = yield db_1.prismaClient.message.findMany({
            where: { fromId: userId },
            select: { to: true },
        });
        const receivedFrom = yield db_1.prismaClient.message.findMany({
            where: { toId: userId },
            select: { from: true },
        });
        const users = [
            ...sentTo.map((m) => m.to),
            ...receivedFrom.map((m) => m.from),
        ];
        const uniqueUsersMap = new Map();
        for (const user of users) {
            uniqueUsersMap.set(user.id, user);
        }
        const uniqueUsers = Array.from(uniqueUsersMap.values());
        const enrichedUsers = yield Promise.all(uniqueUsers.map((user) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const lastMessage = yield db_1.prismaClient.message.findFirst({
                where: {
                    OR: [
                        { fromId: user.id, toId: userId },
                        { fromId: userId, toId: user.id },
                    ],
                },
                orderBy: { createdAt: "desc" },
            });
            const unreadCount = yield db_1.prismaClient.message.count({
                where: {
                    fromId: user.id,
                    toId: userId,
                    read: false,
                },
            });
            return Object.assign(Object.assign({}, user), { lastMessageTimestamp: (_b = (_a = lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null, unreadCount });
        })));
        return enrichedUsers;
    }),
    getMessagesWithUser: (_1, _a, ctx_1) => __awaiter(void 0, [_1, _a, ctx_1], void 0, function* (_, { to }, ctx) {
        if (!ctx.user)
            throw new Error("Unauthenticated");
        return db_1.prismaClient.message.findMany({
            where: {
                OR: [
                    { fromId: ctx.user.id, toId: to },
                    { fromId: to, toId: ctx.user.id },
                ],
            },
            orderBy: { createdAt: "asc" },
            include: {
                from: true,
                to: true,
            },
        });
    }),
    verifyGoogleToken: (parent_1, _a) => __awaiter(void 0, [parent_1, _a], void 0, function* (parent, { token }) {
        const restoken = yield user_1.default.verifyGoogleAuthToken(token);
        return restoken;
    }),
    getCurrentUser: (parent, args, ctx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const id = (_a = ctx.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!id)
            return null;
        const user = yield user_1.default.getUserById(id);
        return user;
    }),
    getUserById: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { id }, ctx) { return user_1.default.getUserById(id); }),
    //we want to ffetch user info by id
    users: () => __awaiter(void 0, void 0, void 0, function* () {
        return db_1.prismaClient.user.findMany();
    }),
    getBookmarkedTweets: (parent, args, ctx) => __awaiter(void 0, void 0, void 0, function* () {
        if (!ctx.user)
            throw new Error("Unauthenticated");
        const bookmarks = yield db_1.prismaClient.bookmark.findMany({
            where: {
                userId: ctx.user.id,
            },
            include: {
                tweet: {
                    include: {
                        author: true,
                    },
                },
            },
        });
        return bookmarks.map((b) => b.tweet);
    }),
};
// also there is no extra resolver for tweets
//this time u want tweets for a  user
const extraResolvers = {
    User: {
        tweets: (parent) => db_1.prismaClient.tweet.findMany({ where: { author: { id: parent.id } } }),
        followers: (parent) => __awaiter(void 0, void 0, void 0, function* () {
            const res = yield db_1.prismaClient.follows.findMany({
                where: { following: { id: parent.id } },
                include: {
                    follower: true,
                },
            });
            return res.map((el) => el.follower);
        }),
        following: (parent) => __awaiter(void 0, void 0, void 0, function* () {
            // if u want to get that whom i am following , i have to say/ask where i am the follower
            const res = yield db_1.prismaClient.follows.findMany({
                where: { follower: { id: parent.id } },
                include: {
                    following: true,
                },
            });
            return res.map((el) => el.following);
        }),
        recommendedUser: (parent, args, ctx) => __awaiter(void 0, void 0, void 0, function* () {
            if (!ctx.user)
                return [];
            const cacheKey = `RECOMMENDED_USERS:${ctx.user.id}`;
            if (!args.forceRefresh) {
                const cachedValue = yield redis_1.redisClient.get(`RECOMMENDED_USERS:${ctx.user.id}`); //key
                if (cachedValue)
                    return JSON.parse(cachedValue); // ✅ Parse back to array
                //value
            }
            const myFollowings = yield db_1.prismaClient.follows.findMany({
                //get people to when u r following
                where: {
                    follower: { id: ctx.user.id },
                },
                include: {
                    following: {
                        include: { follower: { include: { following: true } } }, //this will give id of the user that "Mohit " follows , and u follow "Mohit"
                    },
                },
            });
            const users = [];
            for (const followings of myFollowings) {
                for (const followingofFollowedUser of followings.following.follower) {
                    if (followingofFollowedUser.following.id !== ctx.user.id &&
                        myFollowings.findIndex((e) => (e === null || e === void 0 ? void 0 : e.followingId) === followingofFollowedUser.following.id) < 0) {
                        users.push(followingofFollowedUser.following);
                    }
                }
            }
            //after calculating the res above (which is expensive step) and before returinng it
            // i put that particular cache as string inside our redis cache
            yield redis_1.redisClient.setex(cacheKey, 1, JSON.stringify(users));
            return users;
        }),
        bookmarkedTweets: (parent) => __awaiter(void 0, void 0, void 0, function* () {
            const bookmarks = yield db_1.prismaClient.bookmark.findMany({
                where: { userId: parent.id },
                include: {
                    tweet: {
                        include: {
                            author: true,
                        },
                    },
                },
            });
            return bookmarks.map((b) => b.tweet);
        }),
    },
    //added  isLiked and likesCount amd author name at every tweet
    Tweet: {
        author: (parent) => {
            return db_1.prismaClient.user.findUnique({
                where: { id: parent.authorId },
            });
        },
        isLiked: (parent, _, ctx) => __awaiter(void 0, void 0, void 0, function* () {
            if (!ctx.user)
                return false;
            const existing = yield db_1.prismaClient.like.findUnique({
                where: {
                    tweetId_userId: {
                        tweetId: parent.id,
                        userId: ctx.user.id,
                    },
                },
            });
            return !!existing;
        }),
        likesCount: (parent) => __awaiter(void 0, void 0, void 0, function* () {
            return db_1.prismaClient.like.count({
                where: {
                    tweetId: parent.id,
                },
            });
        }),
    },
};
const mutations = {
    sendMessage: (_1, _a, ctx_1) => __awaiter(void 0, [_1, _a, ctx_1], void 0, function* (_, { to, content }, ctx) {
        if (!ctx.user || !ctx.user.id)
            throw new Error("Unauthenticated");
        yield db_1.prismaClient.message.create({
            data: {
                content,
                fromId: ctx.user.id,
                toId: to,
            },
        });
        return true;
    }),
    loginWithEmail: (_, args) => __awaiter(void 0, void 0, void 0, function* () {
        const user = yield db_1.prismaClient.user.findUnique({
            where: { email: args.email },
        });
        if (!user) {
            throw new Error("User not found");
        }
        if (!user.password) {
            throw new Error("Password not set for this user");
        }
        const isValid = yield bcrypt_1.default.compare(args.password, user.password);
        if (!isValid) {
            throw new Error("Invalid password");
        }
        return jwt_1.default.generateTokenForUser(user);
    }),
    markMessagesAsRead: (_1, _a, ctx_1) => __awaiter(void 0, [_1, _a, ctx_1], void 0, function* (_, { fromId }, ctx) {
        if (!ctx.user)
            throw new Error("Unauthenticated");
        yield db_1.prismaClient.message.updateMany({
            where: {
                fromId,
                toId: ctx.user.id,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
        return true;
    }),
    createAccount: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { email, firstName, lastName, password, }, ctx) {
        const user = yield user_1.default.createAccount({
            email,
            firstName,
            lastName,
            password,
        });
        return jwt_1.default.generateTokenForUser(user);
    }),
    followUser: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { to }, ctx) {
        if (!ctx.user || !ctx.user.id)
            throw new Error("unauthenticated");
        yield user_1.default.followUser(ctx.user.id, to);
        yield redis_1.redisClient.del(`RECOMMENDED_USERS:${ctx.user.id}`);
        return true;
    }),
    unfollowUser: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { to }, ctx) {
        if (!ctx.user || !ctx.user.id)
            throw new Error("unauthenticated");
        yield user_1.default.unfollowUser(ctx.user.id, to);
        yield redis_1.redisClient.del(`RECOMMENDED_USERS:${ctx.user.id}`);
        return true;
    }),
    bookmarkTweet: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { tweetId }, ctx) {
        if (!ctx.user)
            throw new Error("Unauthorized");
        yield db_1.prismaClient.bookmark.create({
            data: {
                userId: ctx.user.id,
                tweetId,
            },
        });
        return true;
    }),
    removeBookmark: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { tweetId }, ctx) {
        if (!ctx.user)
            throw new Error("Unauthorized");
        yield db_1.prismaClient.bookmark.deleteMany({
            where: {
                userId: ctx.user.id,
                tweetId,
            },
        });
        return true;
    }),
    //added new like/unlike tweet
    likeTweet: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { tweetId }, ctx) {
        if (!ctx.user)
            throw new Error("Unauthorized");
        yield db_1.prismaClient.like.create({
            data: {
                tweetId,
                userId: ctx.user.id,
            },
        });
        return true;
    }),
    unlikeTweet: (parent_1, _a, ctx_1) => __awaiter(void 0, [parent_1, _a, ctx_1], void 0, function* (parent, { tweetId }, ctx) {
        if (!ctx.user)
            throw new Error("Unauthorized");
        yield db_1.prismaClient.like.deleteMany({
            where: {
                tweetId,
                userId: ctx.user.id,
            },
        });
        return true;
    }),
};
exports.resolvers = { queries, extraResolvers, mutations };
