import axios from "axios";
import { prismaClient } from "../../client/db";
import JWTService from "../../services/jwt";
import { GraphqlContext } from "../../interfaces";

interface GoogleTokenResult {
    iss?: string;
    azp?: string;
    aud?: string;
    sub?: string
    email: string
    email_verified: string;
    nbf?: string;
    name?: string;
    picture?: string;
    given_name: string;
    family_name?: string;
    iat?: string;
    exp?: string
    jti?: string
    alg?: string
    kid?: string;
    typ?: string

}
const queries = {
    verifyGoogleToken: async (parent: any, { token }: { token: string }) => {
        //here user will give me the google token
        const googleToken = token; 
        const googleOauthURL = new URL('https://oauth2.googleapis.com/tokeninfo')
        googleOauthURL.searchParams.set('id_token', googleToken)
            // i will ask useer that  who is this user 
        const { data } = await axios.get<GoogleTokenResult>(googleOauthURL.toString(), {
            responseType: 'json'
        })// by this u r making API call to  gooogle server and u r passing the googleToken of user
        //data => data os user 

        const user = await prismaClient.user.findUnique({
            where: { email: data.email },
        });//make a call to check if user is there exist or not in database

        if (!user) {
            await prismaClient.user.create({
                data: {
                    email: data.email,
                    firstName: data.given_name,
                    lastName: data.family_name,
                    profileImageURL: data.picture,
                }
            })
        }// if user not exist  ,create a user

        //we haev to generate a token for user , for this we need a library "jsonwebtoken"
        // no user exist then create a token for user and return token
        const userIndb = await prismaClient.user.findUnique({ where: { email: data.email }, })

        if (!userIndb) throw new Error('User with mail not found ')

        const userToken = await JWTService.generateTokenForUser(userIndb)

        return userToken;
    },
    getCurrentUser: async (parent:any,args:any,ctx:GraphqlContext) => {
      
        const id  = ctx.user?.id;
        if(!id) return null;

        const user  = await prismaClient.user.findUnique({where :{id}});
        return user;
    },
    
    users: async () => {
        return prismaClient.user.findMany();
    },
};

export const resolvers = { queries };