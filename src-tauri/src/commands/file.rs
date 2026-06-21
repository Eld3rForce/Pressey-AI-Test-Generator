use std::io::{Read, Write};
use std::time::Duration;

use pdf_extract::extract_text;

const MAX_PDF_BYTES: u64 = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT: Duration = Duration::from_secs(30);

#[tauri::command]
pub fn extract_pdf_text(path: &str) -> Result<String, String> {
    extract_text(path).map_err(|e| format!("Failed to extract PDF text: {}", e))
}

/// Fetch a PDF from a URL, stream it to a temp file, and extract text.
/// Returns the extracted text or an error message starting with PDF_FETCH_FAILED: or PDF_EXTRACT_FAILED:.
#[tauri::command]
pub fn fetch_and_extract_pdf_url(url: String) -> Result<String, String> {
    let parsed = url::Url::parse(&url).map_err(|e| {
        format!("PDF_FETCH_FAILED: Invalid URL: {}", e)
    })?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!(
            "PDF_FETCH_FAILED: Unsupported URL scheme '{}' (expected http or https)",
            parsed.scheme()
        ));
    }

    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(FETCH_TIMEOUT))
        .build()
        .new_agent();

    let response: ureq::http::Response<ureq::Body> = agent
        .get(url.as_str())
        .call()
        .map_err(|e| format!("PDF_FETCH_FAILED: HTTP request failed: {}", e))?;

    let mut temp_file = tempfile::NamedTempFile::new()
        .map_err(|e| format!("PDF_FETCH_FAILED: Failed to create temp file: {}", e))?;

    let mut reader = response.into_body().into_reader();
    let mut total_bytes: u64 = 0;
    let mut buffer = [0u8; 8192];

    loop {
        let n = reader
            .read(&mut buffer)
            .map_err(|e| format!("PDF_FETCH_FAILED: Read error: {}", e))?;
        if n == 0 {
            break;
        }
        total_bytes += n as u64;
        if total_bytes > MAX_PDF_BYTES {
            return Err(format!(
                "PDF_FETCH_FAILED: PDF exceeds 50 MB cap (got {} bytes)",
                total_bytes
            ));
        }
        temp_file
            .write_all(&buffer[..n])
            .map_err(|e| format!("PDF_FETCH_FAILED: Write error: {}", e))?;
    }

    temp_file
        .flush()
        .map_err(|e| format!("PDF_FETCH_FAILED: Flush error: {}", e))?;

    let text = pdf_extract::extract_text(temp_file.path())
        .map_err(|e| format!("PDF_EXTRACT_FAILED: {}", e))?;

    Ok(text)
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

