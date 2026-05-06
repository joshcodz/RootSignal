import dotenv from "dotenv";
dotenv.config();

const token = process.env.GITHUB_ACCESS_TOKEN;
const repo = process.env.GITHUB_REPO;

const response = await fetch(`https://api.github.com/repos/${repo}/commits`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  },
});

console.log("Status:", response.status);
const data = await response.json();
console.log("Response:", JSON.stringify(data, null, 2).slice(0, 500));