import { PrismaClient } from "@prisma/client";

export const prismaClient = new PrismaClient({log:["query"]});
// if i have to see what queries are beign run by this particular command