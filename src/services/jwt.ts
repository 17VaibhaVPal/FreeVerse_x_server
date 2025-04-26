import { User } from "@prisma/client";

import JWT from 'jsonwebtoken'
import { JWTUser } from "../interfaces";


// this function "JWTServices " is going to generate tokens for us 
const JWT_secret = "$uper@30.";

class JWTService {
    public static  generateTokenForUser(user:User) {
        
        const payload : JWTUser = {
            id: user?.id,
            email: user?.email,
        };
        const token = JWT.sign(payload, JWT_secret);
        return token ;

    }

    public static decodeToken(token:string){
        try {
            return JWT.verify(token,JWT_secret) as JWTUser;
        } catch (error) {
            null;
        }
        
    }

}
export default  JWTService;
// this function "JWTServices " is going to generate tokens for us 