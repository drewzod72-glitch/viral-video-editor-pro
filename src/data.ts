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
