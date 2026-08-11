const { spawn } = require("child_process");

console.log("Starting API tunnel via localtunnel...");

const lt = spawn("npx", ["localtunnel", "--port", "4000"], {
  shell: true,
});

let expoChild = null;

lt.stdout.on("data", (data) => {
  const output = data.toString();
  console.log(output);
  
  const match = output.match(/your url is: (https:\/\/.+)/);
  if (match && match[1]) {
    const apiUrl = match[1].trim();
    console.log(`\n> API Tunneled at: ${apiUrl}`);
    console.log(`> Starting Expo with EXPO_PUBLIC_API_URL=${apiUrl}\n`);

    expoChild = spawn("expo", ["start", "--tunnel", "-c"], {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        EXPO_PUBLIC_API_URL: apiUrl,
      },
    });

    expoChild.on("exit", (code) => {
      lt.kill();
      process.exit(code || 0);
    });
  }
});

lt.stderr.on("data", (data) => {
  console.error("Localtunnel error:", data.toString());
});

lt.on("exit", () => {
  if (expoChild) expoChild.kill();
  process.exit(0);
});

process.on("SIGINT", () => {
  if (expoChild) expoChild.kill();
  lt.kill();
  process.exit();
});
