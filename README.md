# Watch & Earn

import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Wallet, ArrowRight, Play, Volume2, VolumeX, ShieldAlert } from 'lucide-react';

// স্যাম্পল ভিডিও ডাটা ও এড লজিক
const DUMMY_FEED = [
  { id: 'v1', type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4', user: '@nature_king', caption: 'সুন্দর প্রকৃতির দৃশ্য! 🌿 #nature', likes: 1200 },
  { id: 'v2', type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-mother-with-her-little-daughter-eating-apples-40149-large.mp4', user: '@family_time', caption: 'সুন্দর বিকেল ❤️ #vlog', likes: 3400 },
  { 
    id: 'ad1', 
    type: 'forced_ad', 
    title: 'স্পন্সরড এডভার্টাইজমেন্ট', 
    duration: 10, // ১০ সেকেন্ড বাধ্যতামূলক দেখতে হবে
    sponsor: 'Monetag / Custom Sponsor' 
  },
  { id: 'v3', type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-a-girl-blowing-a-bubble-gum-bubble-41537-large.mp4', user: '@fun_videos', caption: 'মজার ভিডিও 😂 #funny', likes: 890 }
];

export default function TikTokUserApp() {
  const [points, setPoints] = useState(0);
  const [balance, setBalance] = useState(0); // টাকা
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // ভিডিও দেখলে পয়েন্ট যোগ
  const handleVideoEnd = () => {
    const updatedPoints = points + 1; // ১ ভিডিও = ১ পয়েন্ট
    setPoints(updatedPoints);
    if (updatedPoints >= 100) { // ১০০০ পয়েন্ট = ১০ টাকা (১০০ পয়েন্ট = ১ টাকা)
      setBalance(balance + (updatedPoints / 100) * 1);
    }
  };

  // উইথড্র হ্যান্ডলার
  const handleWithdraw = (e) => {
    e.preventDefault();
    if (Number(withdrawAmount) < 50) {
      alert('সর্বনিম্ন ৫০ টাকা উইথড্র করতে পারবেন!');
      return;
    }
    if (Number(withdrawAmount) > balance) {
      alert('আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই!');
      return;
    }
    alert(`আপনার ৳${withdrawAmount} উইথড্র রিকোয়েস্ট (${paymentMethod}: ${accountNumber}) এডমিন প্যানেলে পাঠানো হয়েছে!`);
    setBalance(balance - Number(withdrawAmount));
    setShowWithdrawModal(false);
  };

  return (
    


      {/* টিকটক বডি মেইন কনটেইনার */}
      


        
        {/* টপ আর্নিং ও উইথড্র হেডার */}
        


          


            ⭐ {points} Pts
            |
            ৳ {balance.toFixed(2)}
          



           setShowWithdrawModal(true)}
            className="bg-gradient-to-r from-pink-500 to-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center space-x-1 shadow-lg"
          >
            
            উইথড্র (৳৫০)
          
        



        {/* টিকটক স্ক্রলিং ফিড */}
        


          {DUMMY_FEED.map((item, index) => (
            


              {item.type === 'forced_ad' ? (
                /* বাধ্যতামূলক বিজ্ঞাপন স্ক্রিন (Forced Ad) */
                
              ) : (
                /* টিকটক ভিডিও কার্ড */
                
              )}
            


          ))}
        



        {/* উইথড্র পপআপ মডাল */}
        {showWithdrawModal && (
          


            


              


                টাকা ক্যাশ আউট করুন
                 setShowWithdrawModal(false)} className="text-gray-400">✕
              


              
              


                


                  পেমেন্ট মেথড সিলেক্ট করুন:
                  


                     setPaymentMethod('bkash')}
                      className={`py-2 rounded-xl border text-xs font-bold ${paymentMethod === 'bkash' ? 'bg-pink-600 border-pink-500' : 'bg-gray-800 border-gray-700'}`}
                    >
                      bKash (বিকাশ)
                    
                     setPaymentMethod('nagad')}
                      className={`py-2 rounded-xl border text-xs font-bold ${paymentMethod === 'nagad' ? 'bg-orange-600 border-orange-500' : 'bg-gray-800 border-gray-700'}`}
                    >
                      Nagad (নগদ)
                    
                  


                



                


                  আপনার পার্সোনাল নম্বর:
                   setAccountNumber(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                  />
                



                


                  টাকার পরিমাণ (সর্বনিম্ন ৳৫০):
                   setWithdrawAmount(e.target.value)}
                    required
                    min="50"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                  />
                



                
                  উইথড্র রিকোয়েস্ট পাঠান
                
              


            


          


        )}

      


    


  );
}

// স্কিপ-না-করা বাধ্যতামূলক এড কম্পোনেন্ট
function ForcedAdCard({ ad, onAdComplete }) {
  const [timeLeft, setTimeLeft] = useState(ad.duration);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(timer);
    } else {
      setCompleted(true);
      onAdComplete();
    }
  }, [timeLeft]);

  return (
    


      


        SPONSORED AD
      



      
      

{ad.title}


      

বিজ্ঞাপনটি সম্পূর্ণ না দেখলে পরবর্তী ভিডিও দেখা বা পয়েন্ট অর্জন করা সম্ভব নয়!



      {!completed ? (
        


          অপেক্ষা করুন: {timeLeft} সেকেন্ড...
        


      ) : (
        


          ✓ বিজ্ঞাপন সম্পন্ন হয়েছে! (+পয়েন্ট যোগ হয়েছে)
        


      )}
    


  );
}

// ভিডিও কার্ড কম্পোনেন্ট
function VideoFeedCard({ video, onEnded }) {
  return (
    


      
      


        

{video.user}


        

{video.caption}


      


    


  );
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://earn-play-withdraw.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/85cd6028-958c-5d96-b92e-8a54278ec2b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
