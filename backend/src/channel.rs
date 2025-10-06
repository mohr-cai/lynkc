use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{config::MAX_CHANNEL_BYTES, error::AppError};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelFile {
    pub id: String,
    pub name: String,
    #[serde(rename = "mime_type")]
    pub mime_type: String,
    pub size: u64,
    #[serde(rename = "data_base64")]
    pub data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelData {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub files: Vec<ChannelFile>,
}

pub fn generate_channel_id() -> String {
    let raw = Uuid::new_v4().simple().to_string();
    raw[..8].to_string()
}

pub fn validate_channel_data(data: &ChannelData) -> Result<(), AppError> {
    let mut total = data.text.as_bytes().len();
    for file in &data.files {
        let decoded = BASE64_ENGINE
            .decode(&file.data_base64)
            .map_err(|_| AppError::InvalidFileData)?;
        total = total
            .checked_add(decoded.len())
            .ok_or(AppError::PayloadTooLarge)?;
    }

    if total > MAX_CHANNEL_BYTES {
        return Err(AppError::PayloadTooLarge);
    }

    Ok(())
}

pub fn serialize_channel(data: &ChannelData) -> Result<String, AppError> {
    Ok(serde_json::to_string(data)?)
}

pub fn deserialize_channel(raw: String) -> ChannelData {
    serde_json::from_str(&raw).unwrap_or_else(|_| ChannelData {
        text: raw,
        files: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::generate_channel_id;

    #[test]
    fn generated_channel_id_is_short_and_uniqueish() {
        let first = generate_channel_id();
        let second = generate_channel_id();
        assert_eq!(first.len(), 8);
        assert_ne!(first, second);
    }
}
