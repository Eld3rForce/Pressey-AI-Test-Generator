use pdf_extract::extract_text;

#[tauri::command]
pub fn extract_pdf_text(path: &str) -> Result<String, String> {
    extract_text(path).map_err(|e| format!("Failed to extract PDF text: {}", e))
}

#[cfg(test)]
mod fetch_and_extract_pdf_url_tests {
    use httpmock::prelude::*;

    #[test]
    fn test_invalid_url_scheme() {
        // Call with ftp://...; expect Err containing "Invalid URL" or "PDF_FETCH_FAILED"
        let result = super::fetch_and_extract_pdf_url("ftp://example.com".to_string());
        // The actual function returns Result<String, String>
        assert!(result.is_err());
    }

    #[test]
    fn test_unreachable_url() {
        // Port 1 is virtually always closed; expect Err
        let result = super::fetch_and_extract_pdf_url("http://127.0.0.1:1".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_http_404() {
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(GET).path("/file.pdf");
            then.status(404);
        });

        let url = server.url("/file.pdf");
        let result = super::fetch_and_extract_pdf_url(url);
        assert!(result.is_err());
        mock.assert();
    }

    #[test]
    fn test_oversized_response() {
        // Mock a response with Content-Length: 100_000_000 (100MB, exceeds 50MB cap)
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(GET).path("/big.pdf");
            then.status(200)
                .header("content-length", "100000000")
                .body("pretend-pdf-content");
        });

        let url = server.url("/big.pdf");
        let result = super::fetch_and_extract_pdf_url(url);
        assert!(result.is_err());
        mock.assert();
    }

    #[test]
    fn test_non_pdf_response() {
        // Mock a response with HTML instead of PDF
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(GET).path("/file.pdf");
            then.status(200)
                .header("content-type", "text/html")
                .body("<html><body>not a pdf</body></html>");
        });

        let url = server.url("/file.pdf");
        let result = super::fetch_and_extract_pdf_url(url);
        // pdf-extract will fail on non-PDF
        assert!(result.is_err());
        mock.assert();
    }
}

