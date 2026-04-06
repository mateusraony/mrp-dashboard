// Universal tooltip — hover or click to show explanation
import { useState, useRef, useEffect } from 'react';

export default function Tooltip({ children, content, title, width = 240 }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const tipRef = useRef(null);

  const show = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - width - 16),
    });
    setVisible(true);
  };

  const hide = () => setVisible(false);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && tipRef.current && !tipRef.current.contains(e.target)) {
        hide();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => { e.stopPropagation(); setVisible(v => !v); }}
        style={{ display: 'inline-flex', cursor: 'help' }}
      >
        {children}
      </span>

      {visible && (
        <div
          ref={tipRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width,
            background: '#0d1421',
            border: '1px solid #2a3f5f',
            borderRadius: 10,
            padding: '12px 14px',
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            pointerEvents: 'auto',
          }}
        >
          {title && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#f1f5f9',
              marginBottom: 6, letterSpacing: '-0.01em',
            }}>
              {title}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.65 }}>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

// Compact "?" help icon with tooltip
export function HelpIcon({ title, content, width }) {
  return (
    <Tooltip title={title} content={content} width={width}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%',
        background: 'rgba(100,116,139,0.15)',
        border: '1px solid rgba(100,116,139,0.3)',
        color: '#64748b', fontSize: 9, fontWeight: 700,
        cursor: 'help', flexShrink: 0, marginLeft: 4,
        lineHeight: 1,
      }}>?</span>
    </Tooltip>
  );
}
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props} />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { TooltipRoot as Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
