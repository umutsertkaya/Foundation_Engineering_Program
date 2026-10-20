import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
