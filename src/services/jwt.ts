import { User } from "@prisma/client";
import { prismaClient } from "../client/db"
import JWT from 'jsonwebtoken'


// this function "JWTServices " is going to generate tokens for us 
const JWT_secret = "$uper@30.";

class JWTService {
    public static  generateTokenForUser(user:User) {
        
        const payload = {
            id: user?.id,
            email: user?.email,
        };
        const token = JWT.sign(payload, JWT_secret);
        return token;
    }
}
export default  JWTService;
// this function "JWTServices " is going to generate tokens for us 