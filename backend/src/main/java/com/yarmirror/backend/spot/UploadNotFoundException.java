package com.yarmirror.backend.spot;

public class UploadNotFoundException extends RuntimeException {

    public UploadNotFoundException(String message) {
        super(message);
    }
}
