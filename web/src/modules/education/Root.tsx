import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { TopicPage } from "./pages/TopicPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="topic/:id" element={<TopicPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
