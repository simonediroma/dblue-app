import React from 'react';
import { motion } from 'motion/react';

const SplashScreen = () => {
  return (
    <motion.div initial="{{" opacity:="" 1="" }}="" exit="{{" opacity:="" 0="" }}="" transition="{{" duration:="" 0.8,="" ease:="" "easeinout"="" }}="" classname="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6">
      <div classname="flex flex-col items-center gap-2 max-w-sm w-full">
        {/* Secondary text */}
        <span classname="text-[10px] sm:text-[12px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em] font-sans">
          (DBL Logo here)
        </span>

        {/* Text with animated gradient and soft blue shadow */}
        <div classname="relative text-center">
          <div classname="absolute inset-0 bg-[#36A9C2] blur-[30px] opacity-10 rounded-full"/>
          <h1 classname="text-4xl sm:text-5xl font-headline font-bold tracking-tight splash-gradient-text relative z-10">
            Presence App
          </h1>
        </div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
