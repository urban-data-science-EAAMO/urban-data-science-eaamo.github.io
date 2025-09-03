import type { Site, SocialObjects } from "./types";

export const PROFILE = {
  name: "Urban Data Science & Equitable Cities",
  title: "EAAMO Bridges Working Group",
  profilePic: "/assets/profile_photo.png",
  bio: "A working group on urban data science and equity, hosting talks, studies, and workshops on computational analysis of urban data to explore and address inequities.",
  location: "Global / Hybrid",
  links: {
    github: "https://github.com/urban-data-science-EAAMO/",
  },
  stats: {
    photos: 0,
    albums: 0,
    views: 0
  }
};

export const SITE: Site = {
  website: "https://bridges.eaamo.org/working_groups/urban-ds-equitable-cities/",
  author: "EAAMO Bridges",
  profile: "https://bridges.eaamo.org/working_groups/urban-ds-equitable-cities/",
  desc: "EAAMO Bridges Urban Data Science & Equitable Cities working group: biweekly talks, paper studies, and workshops on computational urban data analysis to explore and address inequities.",
  title: "Urban Data Science & Equitable Cities | EAAMO Bridges",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 3,
  scheduledPostMargin: 15 * 60 * 1000,
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/eaamo-bridges",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Facebook",
    href: "",
    linkTitle: `${SITE.title} on Facebook`,
    active: false,
  },
  {
    name: "Instagram",
    href: "",
    linkTitle: `${SITE.title} on Instagram`,
    active: false,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/eaamo/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:bridges@eaamo.org",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "Twitter",
    href: "https://x.com/eaamo_org",
    linkTitle: `${SITE.title} on Twitter`,
    active: true,
  },
  {
    name: "Twitch",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Twitch`,
    active: false,
  },
  {
    name: "YouTube",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on YouTube`,
    active: false,
  },
  {
    name: "WhatsApp",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on WhatsApp`,
    active: false,
  },
  {
    name: "Snapchat",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Snapchat`,
    active: false,
  },
  {
    name: "Pinterest",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Pinterest`,
    active: false,
  },
  {
    name: "TikTok",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on TikTok`,
    active: false,
  },
  {
    name: "CodePen",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on CodePen`,
    active: false,
  },
  {
    name: "Discord",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Discord`,
    active: false,
  },
  {
    name: "GitLab",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on GitLab`,
    active: false,
  },
  {
    name: "Reddit",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Reddit`,
    active: false,
  },
  {
    name: "Skype",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Skype`,
    active: false,
  },
  {
    name: "Steam",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Steam`,
    active: false,
  },
  {
    name: "Telegram",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Telegram`,
    active: false,
  },
  {
    name: "Mastodon",
    href: "https://github.com/satnaing/astro-paper",
    linkTitle: `${SITE.title} on Mastodon`,
    active: false,
  },
  {
    name: "Spotify",
    href: "",
    linkTitle: `${SITE.title} on Spotify`,
    active: false,
  }
];

// Social media sharing configuration
export const SOCIAL_SHARING = {
  // Instagram configuration
  instagram: {
    username: "@eaamo_org",
    storySharing: false,
    deepLinking: false,
  },
  // Twitter/X configuration
  twitter: {
    username: "@eaamo_org",
    cardType: "summary_large_image",
  },
  // Default sharing settings
  default: {
    showNativeShare: true,
    showCopyLink: true,
    showInstagramStory: false,
    showWebShare: true,
  },
  // OG image settings
  ogImage: {
    width: 1200,
    height: 630,
    format: "png",
    quality: 90,
  },
} as const;
