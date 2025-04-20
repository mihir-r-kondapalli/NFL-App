// Helper function to detect dark colors
export const isDarkColor = (color?: string): boolean => {
  if (!color) return true;
  
  // For hex colors
  if (color.startsWith('#')) {
    let r, g, b;
    
    if (color.length === 4) { // #RGB format
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else { // #RRGGBB format
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
    }
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.2; // Consider dark if luminance is less than 0.5
  }
  
  // For named colors - just check a few common dark ones
  const darkColors = ['black', 'navy', 'darkblue', 'darkgreen', 'darkred', 'brown', 'purple'];
  return darkColors.includes(color.toLowerCase());
};