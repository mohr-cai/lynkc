use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use rand::{Rng, distributions::Alphanumeric};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::{config::MAX_CHANNEL_BYTES, error::AppError};

const CHANNEL_PASSWORD_LENGTH: usize = 12;

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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoredChannel {
    #[serde(default)]
    pub password_hash: Option<String>,
    #[serde(flatten)]
    pub data: ChannelData,
}

pub fn generate_channel_id() -> String {
    let raw = Uuid::new_v4().simple().to_string();
    raw[..8].to_string()
}

pub fn generate_channel_password() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .map(char::from)
        .take(CHANNEL_PASSWORD_LENGTH)
        .collect()
}

pub fn hash_channel_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn verify_channel_password(stored_hash: Option<&str>, provided: Option<&str>) -> bool {
    match stored_hash {
        Some(hash) if !hash.is_empty() => {
            let Some(provided) = provided else {
                return false;
            };
            let computed = hash_channel_password(provided);
            hash.as_bytes().ct_eq(computed.as_bytes()).into()
        }
        _ => true,
    }
}

pub fn validate_channel_data(data: &ChannelData) -> Result<(), AppError> {
    let mut total = data.text.len();
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

pub fn serialize_channel(data: &StoredChannel) -> Result<String, AppError> {
    Ok(serde_json::to_string(data)?)
}

pub fn deserialize_channel(raw: String) -> StoredChannel {
    serde_json::from_str(&raw).unwrap_or_else(|_| StoredChannel {
        password_hash: None,
        data: ChannelData {
            text: raw,
            files: Vec::new(),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::{
        generate_channel_id, generate_channel_password, hash_channel_password,
        verify_channel_password,
    };

    #[test]
    fn generated_channel_id_is_short_and_uniqueish() {
        let first = generate_channel_id();
        let second = generate_channel_id();
        assert_eq!(first.len(), 8);
        assert_ne!(first, second);
    }

    #[test]
    fn generated_password_has_expected_length() {
        let password = generate_channel_password();
        assert_eq!(password.len(), super::CHANNEL_PASSWORD_LENGTH);
    }

    #[test]
    fn password_hash_verification_succeeds_for_correct_password() {
        let password = "correct horse";
        let hash = hash_channel_password(password);
        assert!(verify_channel_password(Some(&hash), Some(password)));
    }

    #[test]
    fn password_hash_verification_fails_for_incorrect_password() {
        let password = "correct horse";
        let hash = hash_channel_password(password);
        assert!(!verify_channel_password(Some(&hash), Some("wrong")));
        assert!(!verify_channel_password(Some(&hash), None));
    }
}
