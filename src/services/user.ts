import axios from "axios";
import { prismaClient } from "../client/db";
import JWTService from "./jwt";
import bcrypt from "bcrypt";
interface GoogleTokenResult {
  iss?: string;
  azp?: string;
  aud?: string;
  sub?: string;
  email: string;
  email_verified: string;
  nbf?: string;
  name?: string;
  picture?: string;
  given_name: string;
  family_name?: string;
  iat?: string;
  exp?: string;
  jti?: string;
  alg?: string;
  kid?: string;
  typ?: string;
}

class UserService {
  public static async verifyGoogleAuthToken(token: string) {
    //here user will give me the google token
    const googleToken = token;
    const googleOauthURL = new URL("https://oauth2.googleapis.com/tokeninfo");
    googleOauthURL.searchParams.set("id_token", googleToken);
    // i will ask useer that  who is this user
    const { data } = await axios.get<GoogleTokenResult>(
      googleOauthURL.toString(),
      {
        responseType: "json",
      }
    ); // by this u r making API call to  gooogle server and u r passing the googleToken of user
    //data => data os user

    const user = await prismaClient.user.findUnique({
      where: { email: data.email },
    }); //make a call to check if user is there exist or not in database

    if (!user) {
      await prismaClient.user.create({
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
    const userIndb = await prismaClient.user.findUnique({
      where: { email: data.email },
    });

    if (!userIndb) throw new Error("User with mail not found ");

    const userToken = await JWTService.generateTokenForUser(userIndb);

    return userToken;
  }
  public static getUserById(id: string) {
    
    return prismaClient.user.findUnique({ where: { id } });
  }

  public static followUser(from: string, to: string) {
    return prismaClient.follows.create({
      data: {
        follower: { connect: { id: from } },
        following: { connect: { id: to } },
      },
    });
  }

  public static async unfollowUser(from: string, to: string) {
    // (no error if record doesn't exist)
    await prismaClient.follows.deleteMany({
      where: {
        followerId: from,
        followingId: to,
      },
    });
  }

  public static async createAccount({
  email,
  firstName,
  lastName,
  password,
}: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  const existingUser = await prismaClient.user.findUnique({
    where: { email },
  });

  if (existingUser) throw new Error("User already exists");
  
    const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prismaClient.user.create({
    data: {
      email,
      firstName,
      lastName,
      password:hashedPassword, // You should hash this if using password securely
      profileImageURL: "https://api.dicebear.com/7.x/initials/svg?seed=" + firstName,
    },
  });

  return user;
}



}
export default UserService;
