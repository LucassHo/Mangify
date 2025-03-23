'use client'

import Image from "next/image";

export default function NavBar() {
  return (
    <>
      <header className="navbar bg-primary text-primary-content fixed top-0 left-0 right-0 mx-auto shadow-lg rounded-2xl w-11/12 mt-4 z-10">
        <div className="flex-1 flex items-center ml-4">
          <Image src="/favicon.ico" alt="Logo" width={40} height={40} className="mr-2" />
          <a className="btn btn-ghost normal-case text-2xl px-2">Mangify</a>
        </div>
        <div className="flex-none">
          <nav>
            <ul className="menu menu-horizontal text-lg flex items-center gap-4 px-4">
              <li><a href="#" className="hover:underline">Home</a></li>
              <li><a href="#" className="hover:underline">Github</a></li>
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
