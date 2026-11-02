import { useLayoutEffect, useRef, useState } from 'react';

// Tracks the position and width of the active tab so an absolutely positioned
// indicator can slide to it. Attach containerRef to the (position: relative)
// tab container and itemRef(key) to each tab.
export default function useSlidingIndicator(activeKey, deps = []) {
  const containerRef = useRef(null);
  const items = useRef({});
  const [indicator, setIndicator] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = items.current[activeKey];
      setIndicator(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, ...deps]);

  // Keep the active tab visible when the strip scrolls horizontally
  useLayoutEffect(() => {
    const el = items.current[activeKey];
    const box = containerRef.current;
    if (!el || !box) return;
    if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: el.offsetLeft - 24, behavior: 'smooth' });
    }
  }, [activeKey]);

  const itemRef = (key) => (el) => { items.current[key] = el; };

  return { containerRef, itemRef, indicator };
}
