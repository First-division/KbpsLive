export const Station = {
  name: 'AM 1450 KBPS',
  callSign: 'KBPS',
  frequency: 'AM 1450',
  tagline: 'The Voice of the Portland Public Schools',
  location: 'Benson High School, Portland, OR',
  address: '546 NE 12th Ave, Portland, OR 97232',
  phone: '503-916-5277', // 503-916-KBPS
  phoneDisplay: '503-916-KBPS',

  stream: {
    hls: 'https://live.amperwave.net/manifest/kbpsam-kbpsamaac-hlsc1.m3u8?source=v7player',
    mp3: 'https://live.amperwave.net/playlist/kbpsam-kbpsammp3-ibc1.m3u?source=v6player',
    aac: 'https://live.amperwave.net/playlist/kbpsam-kbpsamaac-ibc1.m3u?source=v6player',
  },

  defaultArtwork: 'https://d31wsou9chh9ss.cloudfront.net/0/mobile/images/1456856851/9394/900/900/PlayerDefaultAlbumArt.jpg',

  links: {
    website: 'https://benson.pps.net/kbps',
    player: 'https://player.amperwave.net/2011',
    donate: 'https://pps.schoolpay.com/pay/for/Benson-KBPS-Donations-/Sd7Dd3N',
    facebook: 'https://www.facebook.com/1450KBPS',
    instagram: 'https://www.instagram.com/1450kbps/',
    twitter: 'https://twitter.com/1450kbps',
    youtube: 'https://www.youtube.com/channel/UCrZ--fY3ffAujtTCG5j2PFQ',
    news: 'https://benson.pps.net/fs/pages/38857',
    interviews: 'https://benson.pps.net/fs/pages/38853',
  },

  schedule: [
    { name: 'TCH Children', day: 'Weekdays', time: '7:00 AM', icon: 'child' as const },
    { name: 'Student Broadcasts', day: 'Mon–Fri', time: '8:30 AM – 3:30 PM', icon: 'microphone' as const },
    { name: 'Senior Live Show', day: 'Mon–Fri', time: '12:30 – 1:55 PM', icon: 'star' as const },
    { name: 'Rockin\' Blues', day: 'Friday', time: '4:00 PM', icon: 'music' as const },
    { name: 'Sunday Morning Country Oldies', day: 'Sunday', time: '7:00 – 11:00 AM', icon: 'music' as const },
  ],
} as const;
