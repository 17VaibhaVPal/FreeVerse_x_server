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
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../client/db");
const jwt_1 = __importDefault(require("./jwt"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class UserService {
    static verifyGoogleAuthToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            //here user will give me the google token
            const googleToken = token;
            const googleOauthURL = new URL("https://oauth2.googleapis.com/tokeninfo");
            googleOauthURL.searchParams.set("id_token", googleToken);
            // i will ask useer that  who is this user
            const { data } = yield axios_1.default.get(googleOauthURL.toString(), {
                responseType: "json",
            }); // by this u r making API call to  gooogle server and u r passing the googleToken of user
            //data => data os user
            const user = yield db_1.prismaClient.user.findUnique({
                where: { email: data.email },
            }); //make a call to check if user is there exist or not in database
            if (!user) {
                yield db_1.prismaClient.user.create({
                    data: {
                        email: data.email,
                        firstName: data.given_name,
                        lastName: data.family_name,
                        profileImageURL: data.picture,
                    },
                });
            } // if user not exist  ,create a user
            //we haev to generate a token for user , for this we need a library "jsonwebtoken"
            // no user exist then create a token for user and return token
            const userIndb = yield db_1.prismaClient.user.findUnique({
                where: { email: data.email },
            });
            if (!userIndb)
                throw new Error("User with mail not found ");
            const userToken = yield jwt_1.default.generateTokenForUser(userIndb);
            return userToken;
        });
    }
    static getUserById(id) {
        return db_1.prismaClient.user.findUnique({ where: { id } });
    }
    static followUser(from, to) {
        return db_1.prismaClient.follows.create({
            data: {
                follower: { connect: { id: from } },
                following: { connect: { id: to } },
            },
        });
    }
    static unfollowUser(from, to) {
        return __awaiter(this, void 0, void 0, function* () {
            // (no error if record doesn't exist)
            yield db_1.prismaClient.follows.deleteMany({
                where: {
                    followerId: from,
                    followingId: to,
                },
            });
        });
    }
    static createAccount(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, firstName, lastName, password, }) {
            const existingUser = yield db_1.prismaClient.user.findUnique({
                where: { email },
            });
            if (existingUser)
                throw new Error("User already exists");
            const hashedPassword = yield bcrypt_1.default.hash(password, 10);
            const user = yield db_1.prismaClient.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    password: hashedPassword, // You should hash this if using password securely
                    profileImageURL: "https://api.dicebear.com/7.x/initials/svg?seed=" + firstName,
                },
            });
            return user;
        });
    }
}
exports.default = UserService;
