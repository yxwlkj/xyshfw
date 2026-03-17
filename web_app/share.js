// Simple Web Share / QR Share helper for WeChat sharing
export function shareContent({ title, text, url }) {
  if (navigator.share) {
    return navigator.share({ title, text, url });
  } else {
    // Fallback: generate a QR code URL using Google chart (no external libs)
    const shareUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(url||'')}`;
    // Open a modal or new window with the QR code URL
    window.open(shareUrl, '_blank');
    return Promise.resolve();
  }
}
