import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function triggerDownload() {
  const repo = "Abhishekkkk-15/jarvis-assistant";
  const defaultFallbackUrl = `https://github.com/${repo}/releases/latest`;
  
  try {
    const userAgent = window.navigator.userAgent.toLowerCase();
    let targetExtension = "";
    if (userAgent.includes("win")) {
      targetExtension = ".exe";
    } else if (userAgent.includes("mac")) {
      targetExtension = ".dmg";
    } else if (userAgent.includes("linux")) {
      targetExtension = ".appimage";
    }
    
    if (!targetExtension) {
      window.open(defaultFallbackUrl, "_blank");
      return;
    }
    
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!response.ok) {
      throw new Error("Failed to fetch latest release from GitHub API");
    }
    const data = await response.json();
    const assets = data.assets || [];
    
    // Find asset that ends with the target extension
    const matchingAsset = assets.find((asset: any) => 
      asset.name.toLowerCase().endsWith(targetExtension)
    );
    
    if (matchingAsset && matchingAsset.browser_download_url) {
      window.location.href = matchingAsset.browser_download_url;
    } else {
      window.open(defaultFallbackUrl, "_blank");
    }
  } catch (error) {
    console.error("Error triggering download:", error);
    window.open(defaultFallbackUrl, "_blank");
  }
}
