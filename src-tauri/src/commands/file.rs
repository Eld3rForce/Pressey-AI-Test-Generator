use pdf_extract::extract_text;

#[tauri::command]
pub fn extract_pdf_text(path: &str) -> Result<String, String> {
    extract_text(path).map_err(|e| format!("Failed to extract PDF text: {}", e))
}
