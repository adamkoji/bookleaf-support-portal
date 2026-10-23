import Link from "next/link";

export default function BookLeafLogo({
  variant = "default",
  href = "/",
}) {
  const isInverted = variant === "inverted";

  const content = (
    <div className="inline-flex items-center gap-2 sm:gap-2.5 select-none group shrink-0">
      {/* Official BookLeaf Coral Mark (36x34 on mobile, 44x40 on sm+ with crisp 68%-height SVG slash) */}
      <div
        className={`w-[36px] h-[34px] sm:w-[44px] sm:h-[40px] rounded-none flex items-center justify-center shrink-0 transition-all duration-300 ease-out group-hover:scale-105 group-hover:-rotate-2 group-hover:shadow-md ${
          isInverted
            ? "bg-white text-[#111111]"
            : "bg-[#EC6568] text-white group-hover:bg-[#D95356] group-hover:shadow-[#EC6568]/30"
        }`}
      >
        <svg
          width="44"
          height="40"
          viewBox="0 0 44 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          aria-hidden="true"
        >
          <line
            x1="18"
            y1="31"
            x2="26"
            y2="9"
            stroke={isInverted ? "#111111" : "#FFFFFF"}
            strokeWidth="2.6"
            strokeLinecap="square"
          />
        </svg>
      </div>

      {/* Strictly 2 Clean Light/Thin Rows Spanning the Full Height of the Box */}
      <div className="flex flex-col justify-between h-[34px] sm:h-[40px] py-[0.5px] text-left">
        <span
          className={`text-[16px] sm:text-[20px] font-[360] tracking-[-0.01em] leading-[1.08] whitespace-nowrap transition-colors duration-200 ${
            isInverted
              ? "text-white"
              : "text-[#181818] group-hover:text-[#EC6568]"
          }`}
        >
          BookLeaf Publishing
        </span>
        <span
          className={`text-[13px] sm:text-[17px] font-light tracking-[-0.01em] leading-[1.15] whitespace-nowrap transition-colors duration-200 ${
            isInverted ? "text-white/80" : "text-[#EC6568]"
          }`}
        >
          Support Portal
        </span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
