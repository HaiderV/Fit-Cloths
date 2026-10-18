import { lazy, useState, useEffect } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import Header from "./components/header";
import Footer from "./components/footer";
import GXAgentDrawer from "./components/GXAgentDrawer";

const home = lazy(() => import("./pages/home"));
const search = lazy(() => import("./pages/search"));
const cloth = lazy(() => import("./pages/cloth"));
const cart = lazy(() => import("./pages/cart"));
const fit = lazy(() => import("./pages/fit"))

function Layout() {
    const [cartCount, setCartCount] = useState(() => {
        try {
            const items = JSON.parse(localStorage.getItem('fit_cloth_cart') || '[]');
            return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        } catch {
            return 0;
        }
    });

    useEffect(() => {
        const updateCount = () => {
            try {
                const items = JSON.parse(localStorage.getItem('fit_cloth_cart') || '[]');
                setCartCount(items.reduce((sum, item) => sum + (item.quantity || 1), 0));
            } catch {
                setCartCount(0);
            }
        };

        window.addEventListener('cart_updated', updateCount);
        window.addEventListener('storage', updateCount);
        return () => {
            window.removeEventListener('cart_updated', updateCount);
            window.removeEventListener('storage', updateCount);
        };
    }, []);

    return (
        <>
            <Header cartCount={cartCount} />
            <GXAgentDrawer />
            <Outlet />
            <Footer />
        </>
    );
}

export const router = createBrowserRouter([
    {
        path: "/",
        Component: Layout,
        children: [
            {
                index: true,
                Component: home,
            },
            {
                path: "search",
                Component: search,
            },
            {
                path: "cloth",
                Component: cloth,
            },
            {
                path: "cart",
                Component: cart,
            },
            {
                path: "fit",
                Component: fit,
            }
        ],
    },
]);
