import { VideoProject, MusicTrack } from './types';

// Music catalog — every URL below resolves to a REAL audio file.
// (v1.3.0 cleanup: 13 "tracks" in the old 30-track catalog were actually
// HTML error pages saved with .mp3 names; the real library is track-1..9.
// track-1 is also the lofi track and track-8 the cinematic one.)
const BASE_AUDIO = `${import.meta.env.BASE_URL}audio`;

export const FREE_MUSIC_TRACKS: MusicTrack[] = [
  // ── HYPE (9) ──────────────────────────────────────────────────────────
  { id: 'hype-1',  name: 'Viral Hype',         artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-1.mp3`,  intensity: 'hype' },
  { id: 'hype-2',  name: 'Beat Drop Energy',   artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-2.mp3`,  intensity: 'hype' },
  { id: 'hype-3',  name: 'Trap Anthem',        artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-3.mp3`,  intensity: 'hype' },
  { id: 'hype-4',  name: 'Phonk Drift',        artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-4.mp3`,  intensity: 'hype' },
  { id: 'hype-5',  name: 'Street Pulse',       artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-5.mp3`,  intensity: 'hype' },
  { id: 'hype-6',  name: 'Power Surge',        artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-6.mp3`,  intensity: 'hype' },
  { id: 'hype-7',  name: 'Rush Hour',          artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-7.mp3`,  intensity: 'hype' },
  { id: 'hype-8',  name: 'Neon Drive',         artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-8.mp3`,  intensity: 'hype' },
  { id: 'hype-9',  name: 'Adrenaline',         artist: 'AutoViral', genre: 'Hype',      url: `${BASE_AUDIO}/track-9.mp3`,  intensity: 'hype' },

  // ── LOFI (1) ──────────────────────────────────────────────────────────
  { id: 'lofi-1',  name: 'Sunday Morning',     artist: 'AutoViral', genre: 'Lofi',      url: `${BASE_AUDIO}/track-1.mp3`,  intensity: 'lofi' },

  // ── CINEMATIC (1) ─────────────────────────────────────────────────────
  { id: 'epic-1',  name: 'Cinematic Reveal',   artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-8.mp3`, intensity: 'cinematic' },
];

export const RAW_VIDEO_TEMPLATES = [
  {
    id: 'template-cooking',
    name: 'Sizzling Garlic Ribeye Steak (Cooking)',
    niche: 'cooking' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 30,
    userDescription: 'Cooking a juicy, thick ribeye steak in a piping hot cast iron skillet with generous butter, fresh garlic cloves, and rosemary sprigs. Real fast sizzle sequence.',
    defaultTranscribe: 'Yo! Check this out! Today, we are cooking the ultimate juicy ribeye steak in a piping hot cast iron skillet. First, we get a beautiful sear on high heat. Look at that gorgeous crust! Now, we toss in a massive chunk of unsalted butter, crushed fresh garlic, and green rosemary sprigs. Keep spooning that rich garlic butter over the steak. Hear that beautiful sizzle? Slice it open, perfect medium rare, absolutely mouthwatering! Let\'s eat!'
  },
  {
    id: 'template-unboxing-sneakers',
    name: 'Vintage Suede Sneakers Unboxing (Product Appeal)',
    niche: 'unboxing' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/one-by-one-person-detection.mp4',
    originalDuration: 30,
    userDescription: 'Satisfying shoe unboxing of premium vintage suede sneakers. Tearing crisp tissue wrapping, holding up close texture grain details, reviewing quality.',
    defaultTranscribe: 'Stop scrolling! Look at what just arrived at my door. We are unboxing the absolute cleanest retro suede sneakers of the entire year! Sliding off this vintage premium drawer box... oh, that slide is butter. Tearing back the crisp tissue paper... and there they are! The texture on this genuine suede is unreal, look at that rich grain! The stitching is 100% flawless. This has the ultimate classic throwback comfort with a modern cushy bounce. Honestly, at this price, it is an absolute steal! Would you rock these?'
  },
  {
    id: 'template-sales-bag',
    name: 'Handmade Leather Sling Bag (Sales/DTC Pitch)',
    niche: 'sales' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 30,
    userDescription: 'High-converting Direct-To-Consumer sales feature of customized minimalist leather side sling bag. Sturdy brass accessories and functional side clips.',
    defaultTranscribe: 'If you are still carrying a bulky, heavy backpack in 2026, you are seriously doing it wrong. Check this out. This is the ultimate minimalist handmade leather crossbody bag. It is crafted from waterproof full-grain Italian leather that gets better with age. Look how sleek this custom brass clip snaps shut. It has a hidden magnetic anti-theft pouch on the back for your phone, and a micro-fiber pocket inside for keys and cards. Slim, smart, and built to last a lifetime. Click the link below to get yours with thirty percent off today only!'
  },
  {
    id: 'template-podcast',
    name: 'AI & The Future of Creator Economy (Podcast)',
    niche: 'education' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/store-aisle-detection.mp4',
    originalDuration: 40,
    userDescription: 'Two tech podcasters debating how automated AI tools are going to give standard creators super powers to edit videos in under 5 seconds with zero code or costs.',
    defaultTranscribe: 'Do you realize how insanely fast creator tools are changing? Literally, six months ago, if you wanted a cinematic short clip, you had to hire a professional video editor, pay them hundreds of dollars, and wait three days for the final render. Now, the absolute crazy thing is that anyone with a simple raw smartphone vlog can press one button and completely automate the hook, sync the dynamic subtitles, and analyze the optimal retention curve. It feels illegal to use this for free!'
  },
  {
    id: 'template-fitness',
    name: 'Insane Kinetic Core Workout (Fitness)',
    niche: 'fitness' as const,
    videoUrl: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    originalDuration: 25,
    userDescription: 'High energy vertical shot of an athlete crushing heavy workout sequence. Strong motivational tone about zero excuses.',
    defaultTranscribe: 'Stop scrolling! No excuses. It is exactly five AM, the whole world is fast asleep, and you are still lying in bed thinking about what is coming tomorrow. Get up right now! Every single repetition you skip, your competitor is hitting with double intensity. We are pushing today beyond limits, testing our willpower, and building real focus. Remember, progress does not care about your feelings. Put in the work, grind hard, and let\'s dominate this day!'
  },
  {
    id: 'template-pets-puppy',
    name: 'Golden Retriever Sunrise (Cute Pets)',
    niche: 'pets' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 20,
    userDescription: 'An adorable puppy retriever playing in fresh meadows, tilting its head and looking up directly into the camera lens with hyper expressive eyes.',
    defaultTranscribe: 'This is your official sign to take a 15-second break and look at the happiest puppy on your feed. This is Cooper, and he is enjoying the absolute perfect golden hour sunset in the grass. Look at that little head tilt! He just wants to remind you that whatever you are stressing about right now is going to be completely fine. Take a deep breath, like this video, and drop a comment to wish Cooper a happy day!'
  },
  {
    id: 'template-cooking-matcha',
    name: 'Barista Aesthetic Matcha Swirl (Slow Cooking)',
    niche: 'cooking' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 32,
    userDescription: 'Satisfying zen preparation of fresh organic emerald matcha. Pure whisking routine with chilled steamed organic oat milk pours.',
    defaultTranscribe: 'Here is your quiet morning matcha routine. First, we take two scoops of premium organic stone-ground ceremonial green matcha. Swirl in eighty-degree warm water to unlock that sweet and grassy aroma. Now, we use our bamboo whisk in a vigorous classic W motion to get that ultra-thick emerald froth. Pouring in creamy freshly steamed barista oat milk over our ice stones... look at that swirl ripple dissolve! It is pure natural energy without the heavy caffeine coffee crash. Have an amazing, mindful morning.'
  },
  {
    id: 'template-tech',
    name: 'Mechanical Keyboard Satisfying Build (Tech)',
    niche: 'tech' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4',
    originalDuration: 35,
    userDescription: 'Satisfying sound review and keycaps installation of custom custom linear mechanical keyboard. ASMR keyboard building vibe.',
    defaultTranscribe: 'This is officially the most satisfying mechanical keyboard build I have ever laid mine eyes on. These switches are butter-smooth linear switches lubricated by hand with genuine grease. Let\'s click them in. Listen to that deep, creamy, thocky sound. Now we mount these aesthetic retro PBT keycaps. Testing keys in 3, 2, 1... Oh, my goodness, the feedback is absolutely mind-blowing. Is this keyboard perfection?'
  },
  {
    id: 'template-motivation',
    name: '5 AM Club Morning Routine (Motivation)',
    niche: 'motivation' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 28,
    userDescription: 'Cinematic morning routine montage showing discipline, focus, and early rising. Strong motivational voiceover about grinding while others sleep.',
    defaultTranscribe: 'While you hit snooze, someone is already winning. The 5 AM club is not just a time, it is a mindset. Cold shower, journal, workout, deep work before the world wakes up. The gap between where you are and where you want to be is measured in early mornings. Discipline equals freedom. Get up. Grind now. Thank yourself later.'
  },
  {
    id: 'template-comedy',
    name: 'Relatable Comedy Skit (Comedy)',
    niche: 'comedy' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 22,
    userDescription: 'Funny relatable skit about everyday situations that everyone recognizes. Quick punchlines and visual gags.',
    defaultTranscribe: 'Me pretending to understand the group project in college. Me when the professor asks me a question. Me when my mom says we need to talk. Me when the WiFi goes out during a ranked match. If you related to any of these, drop a like and follow for more chaos!'
  },
  {
    id: 'template-travel',
    name: 'Hidden Gem Travel Vlog (Travel)',
    niche: 'general' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4',
    originalDuration: 35,
    userDescription: 'Stunning travel vlog showcasing a hidden gem destination. Breathtaking landscapes, local culture, and food experiences.',
    defaultTranscribe: 'You will not believe this place exists. Tucked away from every tourist map, this hidden gem is the most underrated destination of the year. Crystal clear waters, ancient architecture, and the friendliest locals you will ever meet. The street food alone is worth the flight. Save this for your next adventure and tag the person you need to bring here.'
  },
  {
    id: 'template-business',
    name: 'Startup Pitch Teaser (Business)',
    niche: 'sales' as const,
    videoUrl: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    originalDuration: 30,
    userDescription: 'High-energy startup pitch teaser showing product demo, problem/solution, and team culture. Designed to attract investors and customers.',
    defaultTranscribe: 'We are solving the problem everyone has but no one talks about. Our AI platform cuts your workflow from days to minutes. We have already onboarded fifty companies, saved them over two million dollars, and we are just getting started. If you are ready to build the future with us, hit that link and join the revolution.'
  },
  {
    id: 'template-fitness-2',
    name: 'HIIT Workout Challenge (Fitness)',
    niche: 'fitness' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 25,
    userDescription: 'High intensity interval training workout with explosive energy. Quick cuts, motivational tone, and strong call to action.',
    defaultTranscribe: 'This is your 20-minute full body HIIT challenge. No equipment needed. We start with jumping jacks, 30 seconds on, 15 seconds rest. Now squats with a twist. Now push-ups. Now mountain climbers. Give it everything you have. The burn means it is working. Push through. Three more seconds. You did it. Cool down and stretch. You are stronger than you think.'
  },
  {
    id: 'template-tech-review',
    name: 'iPhone 16 Pro Max Review (Tech)',
    niche: 'tech' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4',
    originalDuration: 35,
    userDescription: 'Detailed smartphone review covering camera quality, battery life, performance benchmarks, and daily usage experience.',
    defaultTranscribe: 'The iPhone 16 Pro Max is here and after two weeks of daily use, here is my honest review. The camera system is unreal — 48 megapixels with perfect color science. Battery life easily gets me through a full day of heavy use. The A18 Pro chip handles everything I throw at it without breaking a sweat. But the titanium build is what really sells it. Light, premium, and feels incredible in hand. Is it worth the upgrade? If you have an iPhone 13 or older, absolutely yes.'
  },
  {
    id: 'template-comedy-2',
    name: 'When the WiFi Goes Out (Comedy)',
    niche: 'comedy' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 22,
    userDescription: 'Relatable comedy skit about modern life struggles. Quick punchlines and visual gags.',
    defaultTranscribe: 'Me when the WiFi goes out during a ranked match. Me when my mom says we need to talk. Me when the teacher says pop quiz. Me when the group project is due tomorrow and nobody did their part. Me when the charger is at 1% and there is no outlet in sight. If you related to any of these, drop a like and follow for more chaos!'
  },
  {
    id: 'template-education',
    name: 'How to Build a PC in 60 Seconds (Education)',
    niche: 'education' as const,
    videoUrl: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    originalDuration: 30,
    userDescription: 'Quick tutorial showing PC building process. Clear visuals, step-by-step instructions, satisfying ASMR elements.',
    defaultTranscribe: 'Building a PC sounds intimidating but it is actually like adult Lego. First, install the CPU on the motherboard. Be gentle with the pins. Next, slot in the RAM until it clicks. Mount the motherboard in the case. Install the power supply. Connect all cables. Screw in the GPU. Add storage. Plug it in and turn it on. If it lights up, congratulations. You just built your own computer and saved hundreds of dollars.'
  },
  {
    id: 'template-motivation-2',
    name: 'Morning Routine of a Millionaire (Motivation)',
    niche: 'motivation' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 28,
    userDescription: 'Inspiring morning routine montage showing discipline, productivity, and success habits.',
    defaultTranscribe: 'This is the morning routine that changed everything. Wake up at 5 AM. No snooze. No excuses. Drink a glass of water. Meditate for ten minutes. Exercise for thirty minutes. Cold shower. Healthy breakfast. Review your goals. Then start your most important task before the world wakes up. The gap between where you are and where you want to be is measured in early mornings. Discipline equals freedom.'
  },
  {
    id: 'template-pets-2',
    name: 'Cat vs Cucumber (Funny Pets)',
    niche: 'pets' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 20,
    userDescription: 'Funny compilation of cats reacting to cucumbers. Hilarious jumps and unexpected reactions.',
    defaultTranscribe: 'Why are cats so afraid of cucumbers? Scientists think it is because cucumbers resemble snakes. But honestly, watching a cat jump three feet in the air over a vegetable is the funniest thing on the internet. Here is the ultimate compilation of cats versus cucumbers. Each reaction is more dramatic than the last. If this made you laugh, share it with a cat lover.'
  },
  {
    id: 'template-sales-2',
    name: 'How I Sold 1000 Tickets in 24 Hours (Sales)',
    niche: 'sales' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/store-aisle-detection.mp4',
    originalDuration: 30,
    userDescription: 'Marketing breakdown showing ticket sales strategy. Data-driven, actionable insights, urgency creation.',
    defaultTranscribe: 'Last week I sold one thousand concert tickets in twenty-four hours. Here is exactly how I did it. First, I built anticipation with a teaser campaign three days before. Second, I offered an early bird discount for the first hundred buyers. Third, I partnered with micro-influencers who had engaged audiences. Fourth, I created urgency with a countdown timer. Fifth, I made the checkout process dead simple. The key is to create FOMO and remove every possible friction. Your turn. What are you selling?'
  },
  {
    id: 'template-cooking-2',
    name: 'Gordon Ramsay Style Steak (Cooking)',
    niche: 'cooking' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 32,
    userDescription: 'Professional steak cooking tutorial with high-energy commentary and perfect sear technique.',
    defaultTranscribe: 'Right, let us cook the perfect steak. Get your pan screaming hot. Season the steak generously with salt and pepper. Sear for two minutes each side. Baste with butter, garlic, and rosemary. Rest the steak for five minutes. Slice against the grain. Look at that juice. That is how you cook a steak. Simple, elegant, perfect. Enjoy.'
  },
  {
    id: 'template-travel-2',
    name: 'Hidden Waterfall in Bali (Travel)',
    niche: 'general' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4',
    originalDuration: 35,
    userDescription: 'Breathtaking travel vlog showcasing a hidden waterfall. Cinematic shots, local culture, adventure vibes.',
    defaultTranscribe: 'You will not believe this place exists. Tucked away in the jungles of Bali, this hidden waterfall is the most magical spot I have ever found. Crystal clear water cascading down ancient rocks. The locals say it has healing properties. I do not know about that, but I do know this is the most underrated destination in Southeast Asia. Save this for your next adventure and tag the person you need to bring here.'
  },
  {
    id: 'template-business-2',
    name: 'From Zero to $10K Month (Business)',
    niche: 'sales' as const,
    videoUrl: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    originalDuration: 30,
    userDescription: 'Business growth story with actionable steps. Data-driven, motivational, results-focused.',
    defaultTranscribe: 'Twelve months ago I was broke. Today I make ten thousand dollars a month. Here is exactly what changed. I stopped consuming content and started creating. I picked one skill and got dangerously good at it. I built in public and shared my journey. I networked with people better than me. I failed fast and iterated faster. The internet does not care about your background. It only cares about your output. Start today. No excuses.'
  },
  {
    id: 'template-gaming',
    name: 'Insane Gaming Montage (Gaming)',
    niche: 'general' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 25,
    userDescription: 'High-energy gaming highlight reel with epic plays, clutch moments, and sick edits.',
    defaultTranscribe: 'This is not even my best game. One tap headshot. Clutch one versus three. Wall bang through smoke. No scope across map. The crowd goes wild. This is why I love competitive gaming. Every match is a new story. Every play could be the highlight of the year. Like and subscribe for more insane moments.'
  },
  {
    id: 'template-fashion',
    name: 'Outfit of the Day - Street Style (Fashion)',
    niche: 'general' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/people-detection.mp4',
    originalDuration: 28,
    userDescription: 'Fashion lookbook showcasing street style outfit. Quick transitions, trendy music, aesthetic vibes.',
    defaultTranscribe: 'Today is outfit of the day and this street style is absolutely fire. Vintage denim jacket, oversized white tee, high-waisted cargo pants, and chunky white sneakers. Accessorized with a silver chain and retro sunglasses. This fit works for coffee runs, shopping trips, and golden hour photo shoots. Save this for your next outfit inspiration. What would you add to this look?'
  },
  {
    id: 'template-real-estate',
    name: 'Luxury Home Tour - $5M Property (Real Estate)',
    niche: 'sales' as const,
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    originalDuration: 35,
    userDescription: 'Professional real estate listing tour. Cinematic walkthrough, luxury finishes, compelling narration.',
    defaultTranscribe: 'Welcome to this stunning five million dollar modern masterpiece. Four bedrooms, five bathrooms, three thousand square feet of pure luxury. Floor to ceiling windows with panoramic ocean views. Chef is kitchen with Italian marble countertops. Infinity pool overlooking the coastline. Smart home technology throughout. This is not just a house. This is a lifestyle. Schedule your private showing today. This will not last long.'
  },
  {
    id: 'template-podcast-2',
    name: 'How to Network Like a Pro (Podcast Clip)',
    niche: 'education' as const,
    videoUrl: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/store-aisle-detection.mp4',
    originalDuration: 40,
    userDescription: 'Podcast clip with actionable networking advice. Engaging speaker, clear value prop, shareable moment.',
    defaultTranscribe: 'Most people network wrong. They walk into a room and immediately ask what the other person does. That is a terrible opening. Instead, ask about their story. Ask about their biggest challenge. Ask about their wins. People love talking about themselves. Listen more than you speak. Follow up within twenty-four hours with a specific value add. That is how you build real relationships. Not business cards. Not LinkedIn connections. Real relationships. That is the secret.'
  },
  {
    id: 'template-diy',
    name: 'DIY Room Makeover Under $100 (DIY)',
    niche: 'general' as const,
    videoUrl: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    originalDuration: 30,
    userDescription: 'Budget-friendly room transformation. Before/after shots, shopping list, step-by-step instructions.',
    defaultTranscribe: 'I transformed my entire bedroom for under one hundred dollars and the results are insane. First, I painted one accent wall with deep navy blue. Then I added fairy lights behind the headboard. Next, I upcycled old crates into a nightstand. Added large mirror to create space illusion. New bedding from the discount section. Thrifted lamp with a new shade. Total cost: ninety-seven dollars. Your room should be your sanctuary. You do not need a big budget to make it beautiful.'
  },
  {
    id: 'template-car',
    name: 'Porsche 911 Review - Driver Perspective (Automotive)',
    niche: 'general' as const,
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    originalDuration: 35,
    userDescription: 'Professional car review with driving footage, engine sounds, and detailed specs breakdown.',
    defaultTranscribe: 'The Porsche 911 GT3. Five hundred and eleven horsepower. Zero to sixty in 3.2 seconds. Top speed of one hundred ninety-nine miles per hour. But the numbers do not tell the whole story. This car is a symphony of engineering. The sound of that flat-six engine screaming to nine thousand RPM. The way it grips corners like it is on rails. The steering feel that tells you everything. This is not just transportation. This is automotive art. If you ever get the chance to drive one, do not hesitate. Just do it.'
  }
];

export const STOCK_FOOTAGE_BROLL = [
  { id: 'broll-city', url: 'https://assets.mixkit.co/videos/preview/mixkit-typing-on-a-laptop-in-an-office-4492-large.mp4', label: 'Office Typing', category: 'tech' },
  { id: 'broll-nature', url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4', label: 'Nature', category: 'lifestyle' },
  { id: 'broll-people', url: 'https://assets.mixkit.co/videos/preview/mixkit-group-of-friends-laughing-4982-large.mp4', label: 'People Laughing', category: 'social' },
  { id: 'broll-aerial', url: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-11-large.mp4', label: 'City Aerial', category: 'urban' },
  { id: 'broll-food', url: 'https://assets.mixkit.co/videos/preview/mixkit-pouring-water-on-a-salad-4265-large.mp4', label: 'Food Prep', category: 'food' },
  { id: 'broll-tech', url: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-1723-large.mp4', label: 'Coding', category: 'tech' },
  { id: 'broll-fitness', url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-stretching-her-arms-in-the-morning-4807-large.mp4', label: 'Morning Stretch', category: 'fitness' },
  { id: 'broll-money', url: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-womans-hand-holding-a-credit-card-4805-large.mp4', label: 'Credit Card', category: 'business' },
];
