export interface ShareData {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
}

export interface SharePlatform {
  name: string;
  url: string;
  icon: string;
  color: string;
}

export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    name: "Twitter",
    url: "https://twitter.com/intent/tweet",
    icon: "twitter",
    color: "#1DA1F2",
  },
  {
    name: "Facebook",
    url: "https://www.facebook.com/sharer.php",
    icon: "facebook",
    color: "#1877F2",
  },
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/sharing/share-offsite",
    icon: "linkedin",
    color: "#0A66C2",
  },
  {
    name: "WhatsApp",
    url: "https://wa.me",
    icon: "whatsapp",
    color: "#25D366",
  },
  {
    name: "Telegram",
    url: "https://t.me/share/url",
    icon: "telegram",
    color: "#0088CC",
  },
  {
    name: "Pinterest",
    url: "https://pinterest.com/pin/create/button",
    icon: "pinterest",
    color: "#E60023",
  },
  {
    name: "Reddit",
    url: "https://reddit.com/submit",
    icon: "reddit",
    color: "#FF4500",
  },
  {
    name: "Email",
    url: "mailto",
    icon: "mail",
    color: "#EA4335",
  },
];

export function generateShareUrl(platform: SharePlatform, data: ShareData): string {
  const url = new URL(platform.url);
  
  switch (platform.name.toLowerCase()) {
    case "twitter":
      url.searchParams.set("url", data.url);
      url.searchParams.set("text", data.title);
      if (data.description) {
        url.searchParams.set("text", `${data.title}\n\n${data.description}`);
      }
      if (data.tags && data.tags.length > 0) {
        const hashtags = data.tags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
        url.searchParams.set("text", `${url.searchParams.get("text")}\n\n${hashtags}`);
      }
      break;
      
    case "facebook":
      url.searchParams.set("u", data.url);
      break;
      
    case "linkedin":
      url.searchParams.set("url", data.url);
      break;
      
    case "whatsapp":
      url.searchParams.set("text", `${data.title}\n\n${data.url}`);
      break;
      
    case "telegram":
      url.searchParams.set("url", data.url);
      url.searchParams.set("text", data.title);
      break;
      
    case "pinterest":
      url.searchParams.set("url", data.url);
      url.searchParams.set("description", data.title);
      if (data.imageUrl) {
        url.searchParams.set("media", data.imageUrl);
      }
      break;
      
    case "reddit":
      url.searchParams.set("url", data.url);
      url.searchParams.set("title", data.title);
      break;
      
    case "email":
      const subject = encodeURIComponent(data.title);
      const body = encodeURIComponent(`${data.title}\n\n${data.description || ''}\n\n${data.url}`);
      return `mailto:?subject=${subject}&body=${body}`;
      
    default:
      url.searchParams.set("url", data.url);
  }
  
  return url.toString();
}

export function generateInstagramStoryUrl(data: ShareData): string {
  const url = new URL("instagram-stories://share");
  url.searchParams.set("source_application", "web");
  url.searchParams.set("url", data.url);
  if (data.title) url.searchParams.set("title", data.title);
  if (data.description) url.searchParams.set("description", data.description);
  if (data.imageUrl) url.searchParams.set("image", data.imageUrl);
  return url.toString();
}

export function shareToInstagramStory(data: ShareData): void {
  const instagramUrl = generateInstagramStoryUrl(data);
  
  // Try to open Instagram app
  const link = document.createElement('a');
  link.href = instagramUrl;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Fallback to Instagram web after a short delay
  setTimeout(() => {
    window.open("https://instagram.com", '_blank');
  }, 1000);
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}

export function shareViaWebAPI(data: ShareData): Promise<void> {
  if (navigator.share) {
    return navigator.share({
      title: data.title,
      text: data.description,
      url: data.url,
    });
  } else {
    // Fallback: copy URL to clipboard
    return copyToClipboard(data.url);
  }
} 