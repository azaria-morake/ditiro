"use client";

import { useAppStore } from "@/store";
import { Menu } from "lucide-react";

export function MenuButton() {
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
    return (
        <button className="p-2 -ml-2" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
        </button>
    )
}
