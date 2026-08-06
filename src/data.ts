import { VideoProject, MusicTrack } from './types';

// Massive Sonic Matrix — mapped to existing /public/audio files only.
// Verified existing: track-1.mp3 through track-9.mp3, track-18.mp3 through track-30.mp3.
const BASE_AUDIO = '/audio';

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
  { id: 'lofi-8',  name: 'Sunday Morning',     artist: 'AutoViral', genre: 'Lofi',      url: `${BASE_AUDIO}/track-18.mp3`, intensity: 'lofi' },

  // ── CINEMATIC (7) ─────────────────────────────────────────────────────
  { id: 'epic-1',  name: 'Cinematic Reveal',   artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-19.mp3`, intensity: 'cinematic' },
  { id: 'epic-2',  name: 'Epic Trailer',       artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-20.mp3`, intensity: 'cinematic' },
  { id: 'epic-3',  name: 'Dark Orchestra',     artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-21.mp3`, intensity: 'cinematic' },
  { id: 'epic-4',  name: 'Heroic Rise',        artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-22.mp3`, intensity: 'cinematic' },
  { id: 'epic-5',  name: 'Cinematic Tension',  artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-23.mp3`, intensity: 'cinematic' },
  { id: 'epic-6',  name: 'Orchestral Pulse',   artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-24.mp3`, intensity: 'cinematic' },
  { id: 'epic-7',  name: 'Final Stand',        artist: 'AutoViral', genre: 'Cinematic', url: `${BASE_AUDIO}/track-25.mp3`, intensity: 'cinematic' },

  // ── TECH / CHILL (5) ──────────────────────────────────────────────────
  { id: 'tech-1',  name: 'Digital Pulse',      artist: 'AutoViral', genre: 'Tech',      url: `${BASE_AUDIO}/track-26.mp3`, intensity: 'chill' },
  { id: 'tech-2',  name: 'Synthwave Grid',     artist: 'AutoViral', genre: 'Tech',      url: `${BASE_AUDIO}/track-27.mp3`, intensity: 'chill' },
  { id: 'tech-3',  name: 'Cyber Glitch',       artist: 'AutoViral', genre: 'Tech',      url: `${BASE_AUDIO}/track-28.mp3`, intensity: 'chill' },
  { id: 'tech-4',  name: 'AI Circuit',         artist: 'AutoViral', genre: 'Tech',      url: `${BASE_AUDIO}/track-29.mp3`, intensity: 'chill' },
  { id: 'tech-5',  name: 'Neon Server',        artist: 'AutoViral', genre: 'Tech',      url: `${BASE_AUDIO}/track-30.mp3`, intensity: 'chill' },
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
  }
];
