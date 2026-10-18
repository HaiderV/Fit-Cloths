import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { Suspense } from "react";
import "./App.css";

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
