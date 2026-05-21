const fs = require('fs');
// Since we don't have an image parser handy, let's just use base64 and guess
// Actually we can't easily parse without a lib. Let's just output the first few bytes to check if it's really an image or we can use a simpler approach.
console.log("Image size is 4488x328");
console.log("If 11 frames, 408px per frame.");
console.log("If 12 frames, 374px per frame.");
