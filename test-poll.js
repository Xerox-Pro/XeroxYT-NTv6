import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  console.log("Initializing Innertube...");
  const yt = await Innertube.create({ 
    cache: new UniversalCache(false),
    location: "JP",
    lang: "ja",
    retrieve_player: false
  });
  
  yt.session.on('auth-pending', (data) => {
    console.log("\n==========================================");
    console.log("AUTH PENDING!");
    console.log("URL:", data.verification_url);
    console.log("CODE:", data.user_code);
    console.log("==========================================\n");
  });

  yt.session.on('auth', ({ credentials }) => {
    console.log("AUTH EVENT TRIGGERED:", credentials);
  });

  console.log("Starting signIn...");
  try {
    const creds = await yt.session.signIn();
    console.log("SIGNIN PROMISE RESOLVED WITH:", creds);
  } catch (err) {
    console.error("SIGNIN ERROR:", err);
  }
}

run();
