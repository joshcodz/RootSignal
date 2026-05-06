import dotenv from "dotenv";
dotenv.config();

const token = process.env.GITHUB_ACCESS_TOKEN;
console.log("Token starts with:", token?.slice(0, 10));
console.log("Token length:", token?.length);