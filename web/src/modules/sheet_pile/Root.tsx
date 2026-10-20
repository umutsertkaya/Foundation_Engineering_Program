import { Navigate, Route, Routes } from "react-router-dom";
import { SheetPileCreatePage } from "./pages/SheetPileCreatePage";
import { SheetPileDetailPage } from "./pages/SheetPileDetailPage";
import { SheetPileListPage } from "./pages/SheetPileListPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<SheetPileListPage />} />
      <Route path="new" element={<SheetPileCreatePage />} />
      <Route path="s/:sid/*" element={<SheetPileDetailPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
