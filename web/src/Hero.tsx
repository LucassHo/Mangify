import React from "react";
import Image from "next/image";
import Lottie from "lottie-react";

import Bookss from "./anim.json";

const Hero = () => {
  return (
    <section className="hero min-h-screen" style={{ backgroundImage: `url('/bg.gif')` }}>
      <div className="hero-content text-center text-neutral-content">
        <div className="flex flex-col items-center justify-center gap-16 md:flex-row">
          {/* animation */}
          <div className="w-full md:w-5/12 max-w-md mr-20">
            <Lottie animationData={Bookss} loop={true} />
          </div>
          {/* hero desc */}
          <div className="max-w-md text-center md:text-left">
            <h1 className="mb-5 text-4xl md:text-5xl font-bold">
              Welcome to <span className="text-primary font-bold">Mangify</span>
            </h1>
            <p className="mb-8">
              Turn your stories alive with{" "}
              <span className="text-primary font-bold text-xl">consistent</span> visuals
            </p>
            <button className="btn btn-primary hover:btn-primary-focus transition-all duration-300 rounded-2xl">
              Get
              <Image src="/favicon.ico" alt="Logo" width={20} height={20} className="mx-1" />
              Started
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
