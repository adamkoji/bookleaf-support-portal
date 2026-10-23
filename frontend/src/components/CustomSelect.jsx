"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function CustomSelect({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = "Select an option...",
  prefix = "",
  direction = "auto", // "auto" | "up" | "down"
  rounded = "full", // "full" | "xl"
  size = "md", // "sm" | "md"
  className = "",
  menuClassName = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(direction === "up");
  const containerRef = useRef(null);

  // Flatten all options from either `groups` or `options` to find the currently selected item
  const allOptions = useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((g) => g.options || []);
    }
    return options || [];
  }, [groups, options]);

  const selectedOption = useMemo(() => {
    return (
      allOptions.find((opt) => String(opt.value) === String(value ?? "")) ||
      null
    );
  }, [allOptions, value]);

  function toggleMenu() {
    if (disabled) return;
    if (!open && containerRef.current) {
      if (direction === "up") {
        setOpenUpward(true);
      } else if (direction === "down") {
        setOpenUpward(false);
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 280 && spaceAbove > spaceBelow);
      }
    }
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelectOption(optValue) {
    onChange(optValue);
    setOpen(false);
  }

  const roundedClass = rounded === "xl" ? "rounded-xl" : "rounded-full";
  const paddingClass =
    size === "sm"
      ? "px-3.5 py-2.5 sm:py-2 text-xs"
      : "px-4 py-2.5 text-xs sm:text-sm";

  function renderOptionItem(opt) {
    const isSelected = String(opt.value) === String(value ?? "");
    const IconComponent = opt.icon;

    return (
      <button
        key={String(opt.value)}
        type="button"
        onClick={() => handleSelectOption(opt.value)}
        className={`w-full text-left rounded-xl px-3 py-2.5 sm:py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-all duration-150 ${
          isSelected
            ? "bg-[#FFF0F1] text-[#EC6568] font-medium"
            : "text-[#222222] hover:bg-[#FFF0F1] hover:text-[#EC6568] hover:pl-3.5"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {IconComponent && (
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                isSelected
                  ? "bg-[#EC6568] text-white"
                  : "bg-[#FDE8E9] text-[#EC6568]"
              }`}
            >
              <IconComponent className="h-3.5 w-3.5" />
            </div>
          )}

          {opt.initials && !IconComponent && (
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                isSelected
                  ? "bg-[#EC6568] text-white"
                  : "bg-[#FDE8E9] text-[#EC6568]"
              }`}
            >
              {opt.initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-medium truncate">{opt.label}</span>
              {opt.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                    isSelected
                      ? "bg-white/90 text-[#EC6568]"
                      : "bg-[#FFF5F6] text-neutral-500 border border-[#F5D8DA]"
                  }`}
                >
                  {opt.badge}
                </span>
              )}
            </div>
            {opt.sublabel && (
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                {opt.sublabel}
              </p>
            )}
          </div>
        </div>

        {isSelected && <Check className="h-3.5 w-3.5 text-[#EC6568] shrink-0" />}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-white border transition-all duration-200 text-left ${roundedClass} ${paddingClass} ${
          open
            ? "border-[#EC6568] ring-2 ring-[#EC6568]/20 shadow-sm"
            : "border-[#E8D8DA] hover:border-[#EC6568] hover:bg-[#FFFDFD]"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {prefix && (
            <span className="text-neutral-400 font-normal shrink-0">
              {prefix}
            </span>
          )}
          {selectedOption ? (
            <span className="font-medium text-[#222222] truncate">
              {selectedOption.label}
              {selectedOption.badge ? ` (${selectedOption.badge})` : ""}
            </span>
          ) : (
            <span className="text-neutral-400 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 text-[#EC6568] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {/* Animated Floating Menu */}
      <div
        className={`absolute left-0 right-0 min-w-[200px] max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md rounded-2xl border border-[#FAD4D6] shadow-[0_20px_50px_rgba(236,101,104,0.16)] p-2 z-50 transition-all duration-200 ease-out ${
          openUpward ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
        } ${
          open
            ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
            : "scale-95 opacity-0 -translate-y-1 pointer-events-none"
        } ${menuClassName}`}
      >
        <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
          {groups && groups.length > 0
            ? groups.map((group, gIdx) => (
                <div
                  key={group.groupLabel || gIdx}
                  className={gIdx > 0 ? "pt-1.5 mt-1.5 border-t border-[#F8E2E4]" : ""}
                >
                  {group.groupLabel && (
                    <div className="text-[11px] font-semibold tracking-wider uppercase text-[#EC6568] px-3 py-1.5">
                      {group.groupLabel}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {(group.options || []).map((opt) => renderOptionItem(opt))}
                  </div>
                </div>
              ))
            : options.map((opt) => renderOptionItem(opt))}
        </div>
      </div>
    </div>
  );
}

