// Exam submission configuration
const EXAMS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwzX8d0FTC6ZHqhwOJkDny9X9I7Vf4_tPamfgIh9gOmsrBBZubUzFWpQukzB5-8HCSE/exec";

// Replace links with your real files (1WihXw5WnaGJ7ylMxLXNzf5QQOauwab16)
const GROUP_TESTS = {
  G: "https://drive.google.com/drive/folders/1_9Uim86sqITRGqvmj70Obg7rCsMWq93p?dmr=1&ec=wgc-drive-hero-goto",
    B: "https://drive.google.com/drive/folders/1s3WT4Otxssxd4Cxs7pfbsyRqUrWEA5e2?dmr=1&ec=wgc-drive-hero-goto",
    V: "https://drive.google.com/drive/folders/1CkNDZUwmjb2Gh1UNV-_OOaFNno88ojjU?dmr=1&ec=wgc-drive-hero-goto",
    A: "https://drive.google.com/drive/folders/1U82pA65tG8xIoZkJY3b1Trd6krwVFhjp?dmr=1&ec=wgc-drive-hero-goto",
    Armonie: "https://drive.google.com/drive/folders/1pl7d0a2Ljl3OOXcg0YAnP_geCZZutVw2?dmr=1&ec=wgc-drive-hero-goto",
};

const MAX_BYTES = 45 * 1024 * 1024; // ~45MB

// Utility functions
const el = (id) => document.getElementById(id);

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
            const base64 = String(fr.result);
            const pure = base64.split(",")[1] || base64; // strip data: prefix
            resolve(pure);
        };
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}

function validateSize(file) {
    if (!file) return false;
    return file.size <= MAX_BYTES;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateDownloadLink(group) {
    const card = el("downloadCard");
    const btn = el("downloadBtn");
    const info = el("testInfo");
    
    if (!group || !GROUP_TESTS[group] || GROUP_TESTS[group] === "#") {
        card.style.display = "none";
        return;
    }
    
    btn.href = GROUP_TESTS[group];
    info.textContent = `Test for group ${group}`;
    card.style.display = "block";
}

function showStatus(message, type = 'info') {
    const status = el("status");
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    el("status").style.display = 'none';
}

// File handling functions
function handleTheoryFile(file) {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        showStatus('Please select a valid theory file (PDF, JPG, or PNG)', 'error');
        return;
    }
    
    // Validate file size
    if (!validateSize(file)) {
        showStatus('Theory file too large. Keep under ~45MB.', 'error');
        return;
    }
    
    // Display file info
    el("theoryPreview").style.display = 'block';
    el("theoryFileName").textContent = file.name;
    el("theoryFileSize").textContent = formatFileSize(file.size);
    
    hideStatus();
}

function handlePerformanceFile(file) {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav'];
    if (!allowedTypes.includes(file.type)) {
        showStatus('Please select a valid performance file (MP4, MOV, MP3, or WAV)', 'error');
        return;
    }
    
    // Validate file size
    if (!validateSize(file)) {
        showStatus('Performance file too large. Keep under ~45MB.', 'error');
        return;
    }
    
    // Display file info
    el("performancePreview").style.display = 'block';
    el("performanceFileName").textContent = file.name;
    el("performanceFileSize").textContent = formatFileSize(file.size);
    
    hideStatus();
}

// File removal functions
window.removeTheoryFile = function() {
    el("theoryFile").value = '';
    el("theoryPreview").style.display = 'none';
};

window.removePerformanceFile = function() {
    el("performanceFile").value = '';
    el("performancePreview").style.display = 'none';
};

// Main initialization
document.addEventListener("DOMContentLoaded", () => {
    // Group selection handler
    el("group").addEventListener("change", (e) => {
        updateDownloadLink(e.target.value);
    });

    // Theory file upload handling
    const theoryUploadContainer = el("theoryUploadContainer");
    const theoryFileInput = el("theoryFile");
    
    theoryUploadContainer.addEventListener('click', () => theoryFileInput.click());
    
    theoryUploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        theoryUploadContainer.style.borderColor = 'var(--primary-gold)';
        theoryUploadContainer.style.background = 'rgba(214, 158, 46, 0.1)';
    });
    
    theoryUploadContainer.addEventListener('dragleave', () => {
        theoryUploadContainer.style.borderColor = 'var(--border-light)';
        theoryUploadContainer.style.background = 'rgba(255, 255, 255, 0.5)';
    });
    
    theoryUploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        theoryUploadContainer.style.borderColor = 'var(--border-light)';
        theoryUploadContainer.style.background = 'rgba(255, 255, 255, 0.5)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            theoryFileInput.files = files;
            handleTheoryFile(files[0]);
        }
    });
    
    theoryFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleTheoryFile(e.target.files[0]);
        }
    });

    // Performance file upload handling
    const performanceUploadContainer = el("performanceUploadContainer");
    const performanceFileInput = el("performanceFile");
    
    performanceUploadContainer.addEventListener('click', () => performanceFileInput.click());
    
    performanceUploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        performanceUploadContainer.style.borderColor = 'var(--primary-gold)';
        performanceUploadContainer.style.background = 'rgba(214, 158, 46, 0.1)';
    });
    
    performanceUploadContainer.addEventListener('dragleave', () => {
        performanceUploadContainer.style.borderColor = 'var(--border-light)';
        performanceUploadContainer.style.background = 'rgba(255, 255, 255, 0.5)';
    });
    
    performanceUploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        performanceUploadContainer.style.borderColor = 'var(--border-light)';
        performanceUploadContainer.style.background = 'rgba(255, 255, 255, 0.5)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            performanceFileInput.files = files;
            handlePerformanceFile(files[0]);
        }
    });
    
    performanceFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePerformanceFile(e.target.files[0]);
        }
    });

    // Form submission
    el("examForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const submitBtn = el("submitBtn");
        const btnText = submitBtn.querySelector('.btn-text');
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Uploading... Please wait.';
        hideStatus();
        
        try {
            // Get form data
            const firstName = el("firstName").value.trim();
            const lastName = el("lastName").value.trim();
            const course = el("course").value;
            const group = el("group").value;
            const theory = el("theoryFile").files[0];
            const performance = el("performanceFile").files[0];

            // Validate required fields
            if (!firstName || !lastName || !course || !group) {
                throw new Error('Please fill in all required fields');
            }

            // Validate files
            if (!theory || !performance) {
                throw new Error('Please select both theory and performance files');
            }

            // Validate file sizes
            if (!validateSize(theory) || !validateSize(performance)) {
                throw new Error('Files too large. Keep each under ~45MB.');
            }

            showStatus('Converting files to Base64...', 'info');

            // Convert files to Base64
            const [theoryData, performanceData] = await Promise.all([
                toBase64(theory),
                toBase64(performance)
            ]);

            showStatus('Uploading to server...', 'info');

            // Create payload
            const payload = {
                firstName,
                lastName,
                course,
                group,
                theoryFileName: theory.name,
                theoryFileType: theory.type || "application/octet-stream",
                theoryFileData: theoryData,
                performanceFileName: performance.name,
                performanceFileType: performance.type || "application/octet-stream",
                performanceFileData: performanceData,
                timestamp: new Date().toISOString()
            };

            // Send to Google Apps Script
            const res = await fetch(EXAMS_ENDPOINT, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            
            if (!res.ok || data.status !== "success") {
                throw new Error(data.message || "Upload failed");
            }

            // Success!
            showStatus("🎉 Exam submitted successfully! Thank you.", 'success');
            e.target.reset();
            updateDownloadLink(""); // hide download
            el("theoryPreview").style.display = 'none';
            el("performancePreview").style.display = 'none';
        } catch (err) {
            console.error('Exam submission error:', err);
            showStatus(`Error: ${err.message}. Please try again.`, 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.textContent = 'Submit Exam';
        }
    });

    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }));
    }
});
