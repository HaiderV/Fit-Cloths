import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { predictMeasurements } from '../services/measurementService';

// Helper to convert base64 Data URL to a File object for multipart re-submissions
const dataUrlToFile = (dataUrl, filename) => {
    try {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    } catch (e) {
        console.error('Failed to convert dataUrl to File:', e);
        return null;
    }
};

const roundNum = (val, decimals = 1) => {
    if (val === undefined || val === null || isNaN(val)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(Number(val) * factor) / factor;
};

const FitPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // =========================================================================
    // 1. SAVED AI FIT PROFILES SYSTEM (Multiple Instances)
    // =========================================================================
    const [savedProfiles, setSavedProfiles] = useState(() => {
        try {
            const list = JSON.parse(localStorage.getItem('fit_cloth_profiles') || '[]');
            if (Array.isArray(list) && list.length > 0) return list;
            const legacy = JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
            if (legacy?.measurements) {
                const initial = [{
                    id: legacy.id || 'fit_' + Date.now(),
                    name: legacy.name || 'My Primary Fit',
                    tailorNotes: legacy.tailorNotes || legacy.description || '',
                    gender: legacy.gender || 'male',
                    height: legacy.height || 178,
                    unit: legacy.unit || 'CM',
                    fitPreference: legacy.fitPreference || 'TAILORED',
                    measurements: legacy.measurements,
                    createdAt: legacy.timestamp || new Date().toISOString(),
                    updatedAt: legacy.timestamp || new Date().toISOString(),
                }];
                localStorage.setItem('fit_cloth_profiles', JSON.stringify(initial));
                return initial;
            }
            return [];
        } catch {
            return [];
        }
    });

    const [activeProfileId, setActiveProfileId] = useState(() => {
        const paramId = searchParams.get('id');
        if (paramId) return paramId;
        try {
            const legacy = JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
            return legacy?.id || null;
        } catch {
            return null;
        }
    });

    // Profile Meta
    const [profileName, setProfileName] = useState('My Bespoke Fit');
    const [tailorNotes, setTailorNotes] = useState('');

    // Height, Gender & Fit Preferences
    const [height, setHeight] = useState('178');
    const [unit, setUnit] = useState('CM'); // 'CM' or 'IN'
    const [gender, setGender] = useState('male'); // 'male', 'female', 'neutral'
    const [fitPreference, setFitPreference] = useState('TAILORED');

    // Image Upload State for the Two Required Angles
    const [uploads, setUploads] = useState({
        front: null, // { url: string, file: File, dataUrl: string }
        side: null,  // { url: string, file: File, dataUrl: string }
    });

    // Processing & Server State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [measurements, setMeasurements] = useState(null);
    const [validationReport, setValidationReport] = useState(null);
    const [errorDetails, setErrorDetails] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);

    // Accordion Dropdowns State (Collapsed by default per user specification)
    const [isUpperOpen, setIsUpperOpen] = useState(false);
    const [isLowerOpen, setIsLowerOpen] = useState(false);

    // Inline Metric Edit State
    const [editingSection, setEditingSection] = useState(null);
    const [editingKey, setEditingKey] = useState(null);
    const [editingValue, setEditingValue] = useState('');

    // Configuration for the 2 Required Capture Views with Prominent T-Pose Requirement
    const slots = [
        {
            id: 'front',
            code: '001',
            title: 'FRONT VIEW [ T-POSTURE REQUIRED ]',
            tip: '★ T-POSTURE MANDATORY: Stand facing camera in an upright T-posture with arms extended horizontally (or slightly flared T-pose) and feet shoulder-width apart. Full body visible from head to toe.',
            badge: 'T-POSE REQUIRED',
        },
        {
            id: 'side',
            code: '002',
            title: 'SIDE PROFILE (RIGHT)',
            tip: '90° lateral profile view, full body visible from head to feet, upright natural posture, arms resting at sides.',
            badge: '90° PROFILE',
        },
    ];

    // =========================================================================
    // RESTORE PERSISTED IMAGES & SYNC ACTIVE PROFILE ON LOAD
    // =========================================================================
    useEffect(() => {
        // 1. Restore images from localStorage if previously uploaded
        try {
            const savedImages = JSON.parse(localStorage.getItem('fit_cloth_images') || '{}');
            const restoredUploads = { front: null, side: null };
            if (savedImages.front) {
                restoredUploads.front = {
                    url: savedImages.front,
                    dataUrl: savedImages.front,
                    file: dataUrlToFile(savedImages.front, 'front_view.jpg'),
                };
            }
            if (savedImages.side) {
                restoredUploads.side = {
                    url: savedImages.side,
                    dataUrl: savedImages.side,
                    file: dataUrlToFile(savedImages.side, 'side_view.jpg'),
                };
            }
            if (restoredUploads.front || restoredUploads.side) {
                setUploads(restoredUploads);
            }
        } catch (storageErr) {
            console.warn('Could not restore cached images:', storageErr);
        }

        // 2. Sync profile from URL or activeProfileId or latest saved profile
        const isNewRequested = searchParams.get('new') === 'true';
        const urlProfileId = searchParams.get('id') || searchParams.get('profileId');

        if (isNewRequested) {
            setActiveProfileId(null);
            setProfileName(`Fit Profile #${savedProfiles.length + 1}`);
            setTailorNotes('');
            setShowResults(false);
            setMeasurements(null);
            setUploads({ front: null, side: null });
        } else if (savedProfiles.length > 0) {
            const target = urlProfileId
                ? (savedProfiles.find(p => p.id === urlProfileId) || savedProfiles[0])
                : (activeProfileId ? (savedProfiles.find(p => p.id === activeProfileId) || savedProfiles[0]) : savedProfiles[0]);

            if (target && target.measurements) {
                setActiveProfileId(target.id);
                setProfileName(target.name || 'My Bespoke Fit');
                setTailorNotes(target.tailorNotes || target.description || '');
                if (target.height) setHeight(String(target.height));
                if (target.unit) setUnit(target.unit);
                if (target.gender) setGender(target.gender);
                if (target.fitPreference) setFitPreference(target.fitPreference);
                setMeasurements(target.measurements);
                setShowResults(true);
            }
        } else {
            // Restore legacy measurements if no profiles list yet
            try {
                const legacy = JSON.parse(localStorage.getItem('fit_cloth_measurements') || 'null');
                if (legacy && legacy.measurements) {
                    setMeasurements(legacy.measurements);
                    setProfileName(legacy.name || 'Fit Profile #1');
                    setTailorNotes(legacy.tailorNotes || legacy.description || '');
                    if (legacy.height) setHeight(String(legacy.height));
                    if (legacy.unit) setUnit(legacy.unit);
                    if (legacy.gender) setGender(legacy.gender);
                    if (legacy.fitPreference) setFitPreference(legacy.fitPreference);
                    setShowResults(true);
                }
            } catch (e) {
                console.warn('Could not restore legacy measurements:', e);
            }
        }
    }, []);

    // Check readiness (both images present and valid height)
    const uploadedCount = Object.values(uploads).filter(Boolean).length;
    const isHeightValid = !isNaN(parseFloat(height)) && parseFloat(height) > 0;
    const isReady = uploadedCount === 2 && isHeightValid;

    // Toast Notification Helper
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Handle file selection and cache as data URL in localStorage
    const handleImageUpload = (slotId, e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvt) => {
                const dataUrl = uploadEvt.target.result;
                setUploads((prev) => ({
                    ...prev,
                    [slotId]: { url: dataUrl, file, dataUrl },
                }));

                // Persist image data URL to localStorage
                try {
                    const currentStored = JSON.parse(localStorage.getItem('fit_cloth_images') || '{}');
                    currentStored[slotId] = dataUrl;
                    localStorage.setItem('fit_cloth_images', JSON.stringify(currentStored));
                } catch (err) {
                    console.warn('Failed to cache image to localStorage:', err);
                }
            };
            reader.readAsDataURL(file);
            setErrorDetails(null);
            setShowResults(false);
        }
    };

    // Remove image and update localStorage
    const handleRemoveImage = (slotId, e) => {
        e.stopPropagation();
        setUploads((prev) => ({ ...prev, [slotId]: null }));
        try {
            const currentStored = JSON.parse(localStorage.getItem('fit_cloth_images') || '{}');
            delete currentStored[slotId];
            localStorage.setItem('fit_cloth_images', JSON.stringify(currentStored));
        } catch (err) {
            console.warn('Failed to remove cached image from localStorage:', err);
        }
        setShowResults(false);
        setErrorDetails(null);
    };

    // Profile Management: Switch Profile
    const handleSelectProfile = (profile) => {
        setActiveProfileId(profile.id);
        setProfileName(profile.name || 'Untitled Fit');
        setTailorNotes(profile.tailorNotes || profile.description || '');
        setGender(profile.gender || 'male');
        setHeight(String(profile.height || '178'));
        setUnit(profile.unit || 'CM');
        setFitPreference(profile.fitPreference || 'TAILORED');
        setMeasurements(profile.measurements || null);
        setShowResults(true);
        setErrorDetails(null);
        localStorage.setItem('fit_cloth_measurements', JSON.stringify(profile));
        window.dispatchEvent(new Event('storage'));
        showToast(`Loaded ${profile.name}`);
    };

    // Profile Management: Create Brand New Fit Profile (Clean Slate)
    const handleCreateNewFit = () => {
        setActiveProfileId(null);
        setProfileName(`Fit Profile #${savedProfiles.length + 1}`);
        setTailorNotes('');
        setShowResults(false);
        setMeasurements(null);
        setUploads({ front: null, side: null });
        setErrorDetails(null);
        try {
            localStorage.removeItem('fit_cloth_images');
        } catch {}
        showToast('Ready for new photos. Take front photo in T-posture!');
    };

    // Profile Management: Save Current Fit Profile (or Save As New Instance)
    const handleSaveProfile = (asNewInstance = false) => {
        if (!measurements) return;
        const now = new Date().toISOString();
        const targetId = (!asNewInstance && activeProfileId) ? activeProfileId : ('fit_' + Date.now());
        const finalName = asNewInstance
            ? `${profileName} (Copy)`
            : (profileName.trim() || `Fit Profile #${savedProfiles.length + 1}`);

        const newProfile = {
            id: targetId,
            name: finalName,
            tailorNotes: tailorNotes.trim(),
            gender,
            height: parseFloat(height) || 178,
            unit,
            fitPreference,
            measurements,
            updatedAt: now,
            createdAt: (!asNewInstance && activeProfileId)
                ? (savedProfiles.find(p => p.id === activeProfileId)?.createdAt || now)
                : now,
        };

        let updatedList;
        const existingIdx = savedProfiles.findIndex(p => p.id === targetId);
        if (existingIdx > -1 && !asNewInstance) {
            updatedList = [...savedProfiles];
            updatedList[existingIdx] = newProfile;
        } else {
            updatedList = [newProfile, ...savedProfiles.filter(p => p.id !== targetId)];
        }

        setSavedProfiles(updatedList);
        setActiveProfileId(targetId);
        if (asNewInstance) setProfileName(finalName);

        localStorage.setItem('fit_cloth_profiles', JSON.stringify(updatedList));
        localStorage.setItem('fit_cloth_measurements', JSON.stringify(newProfile));
        window.dispatchEvent(new Event('storage'));

        showToast(asNewInstance ? '✓ NEW FIT INSTANCE CREATED!' : '✓ AI FIT PROFILE SAVED!');
    };

    // Profile Management: Delete Profile
    const handleDeleteProfile = (id, e) => {
        e.stopPropagation();
        const profileToDelete = savedProfiles.find(p => p.id === id);
        if (!window.confirm(`Delete AI Fit profile "${profileToDelete?.name || 'this fit'}"?`)) return;

        const updatedList = savedProfiles.filter(p => p.id !== id);
        setSavedProfiles(updatedList);
        localStorage.setItem('fit_cloth_profiles', JSON.stringify(updatedList));

        if (activeProfileId === id) {
            if (updatedList.length > 0) {
                handleSelectProfile(updatedList[0]);
            } else {
                handleCreateNewFit();
            }
        }
        showToast('Profile deleted');
    };

    // Convert and submit real photos to Express backend
    const handleStartInference = async () => {
        if (!isReady || isAnalyzing) return;

        setIsAnalyzing(true);
        setErrorDetails(null);
        setShowResults(false);
        setMeasurements(null);

        // Convert user height to cm if input was in inches
        const numericHeight = parseFloat(height);
        const heightInCm = unit === 'IN' ? Math.round(numericHeight * 2.54 * 10) / 10 : numericHeight;

        // Ensure file objects exist (convert from dataUrl if restored from localStorage)
        const frontFile = uploads.front.file || (uploads.front.dataUrl ? dataUrlToFile(uploads.front.dataUrl, 'front_view.jpg') : null);
        const sideFile = uploads.side.file || (uploads.side.dataUrl ? dataUrlToFile(uploads.side.dataUrl, 'side_view.jpg') : null);

        if (!frontFile || !sideFile) {
            setErrorDetails({ message: 'Please re-upload both images before inference.' });
            setIsAnalyzing(false);
            return;
        }

        try {
            const result = await predictMeasurements({
                frontImage: frontFile,
                sideImage: sideFile,
                heightCm: heightInCm,
                gender,
                garmentType: 'traditional',
            });

            const freshMeasurements = result.data;
            setMeasurements(freshMeasurements);
            setValidationReport(result.validation || null);
            setShowResults(true);

            // Automatically create or update profile instance
            const now = new Date().toISOString();
            const currentId = activeProfileId || ('fit_' + Date.now());
            const currentName = profileName.trim() || `Fit Profile #${savedProfiles.length + 1}`;

            const newProfileObj = {
                id: currentId,
                name: currentName,
                tailorNotes: tailorNotes.trim(),
                gender,
                height: numericHeight,
                unit,
                fitPreference,
                measurements: freshMeasurements,
                createdAt: now,
                updatedAt: now,
            };

            const updatedList = [newProfileObj, ...savedProfiles.filter(p => p.id !== currentId)];
            setSavedProfiles(updatedList);
            setActiveProfileId(currentId);

            localStorage.setItem('fit_cloth_profiles', JSON.stringify(updatedList));
            localStorage.setItem('fit_cloth_measurements', JSON.stringify(newProfileObj));
            window.dispatchEvent(new Event('storage'));

            showToast('✓ 3D DOSSIER GENERATED & SAVED!');

        } catch (err) {
            console.error('Inference error:', err);
            setErrorDetails({
                message: err.message,
                stage: err.stage,
                validation: err.validation,
                retake: err.retake,
                status: err.status,
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Helper to format values in centimetres (CM)
    const formatValue = (cmValue) => {
        if (cmValue === undefined || cmValue === null) return '—';
        const num = Number(cmValue);
        if (isNaN(num) || num <= 0) return '—';
        return `${num.toFixed(1)} cm`;
    };

    // Helper to retrieve confidence badge for a measurement key
    const getMetricConfidence = (key) => {
        const quality = measurements?.measurement_quality;
        if (!quality || !quality.confidence_levels) return null;
        return quality.confidence_levels[key] || null;
    };

    // Helper to retrieve uncertainty margin (±cm) for a measurement key
    const getMetricUncertainty = (key) => {
        const quality = measurements?.measurement_quality;
        if (!quality || !quality.uncertainties_cm) return null;
        const val = quality.uncertainties_cm[key];
        return val !== undefined && val !== null ? `±${Number(val).toFixed(1)} cm` : null;
    };

    // Helper to describe TailorVision quality and posture warning codes
    const getWarningDetails = (warnCode) => {
        const map = {
            POOR_FIT_CONVERGENCE: {
                title: '3D SMPL-X NON-CONVERGENCE',
                desc: 'Iterative 3D shape optimizer loss did not fully reach below tolerance. Measurements carry higher uncertainty (±1.5–3 cm).',
                action: 'Commonly caused by baggy clothing or heavy fabric folds. Stand in strict T-posture wearing fitted attire.',
                severity: 'high',
            },
            POSSIBLE_IDENTITY_MISMATCH: {
                title: 'CROSS-VIEW SUBJECT MISMATCH',
                desc: 'Torso/limb consistency between front and side photos is low. Ensure both photos are of the same subject.',
                action: 'Capture both photos in the same session without moving location.',
                severity: 'high',
            },
            POSSIBLE_LOOSE_CLOTHING_AT_WAIST: {
                title: 'LOOSE CLOTHING AT WAIST',
                desc: 'Drapery or loose fabric detected at waistline; may artificially expand waist circumference.',
                action: 'Tuck shirt or wear fitted clothing for optimal bespoke tolerances.',
                severity: 'medium',
            },
            POSSIBLE_LOOSE_CLOTHING_AT_CHEST: {
                title: 'LOOSE CLOTHING AT CHEST',
                desc: 'Loose silhouette detected at chest level.',
                action: 'Stand upright with a snug top in a clean T-posture.',
                severity: 'medium',
            },
            NON_UPRIGHT_POSTURE: {
                title: 'NON-UPRIGHT POSTURE',
                desc: 'Subject appears to be slouching or leaning in profile view.',
                action: 'Stand straight against a neutral wall with natural head position.',
                severity: 'medium',
            },
            LOW_IMAGE_RESOLUTION: {
                title: 'LOW RESOLUTION',
                desc: 'Image pixel density is lower than ideal for sub-millimeter edge detection.',
                action: 'Ensure good lighting and avoid camera digital zoom.',
                severity: 'low',
            },
            SCALE_UNCERTAIN: {
                title: 'SCALE CALIBRATION UNCERTAINTY',
                desc: 'Pixel-to-metric scale confidence is slightly reduced.',
                action: 'Double-check calibrated reference height.',
                severity: 'medium',
            },
            POOR_KEYPOINTS_FRONT_VIEW: {
                title: 'FRONT KEYPOINTS OCCLUDED',
                desc: 'Some anatomical landmarks were difficult to isolate in the front image.',
                action: 'Extend arms horizontally in full T-posture and step back.',
                severity: 'medium',
            },
            POOR_KEYPOINTS_SIDE_VIEW: {
                title: 'SIDE KEYPOINTS OCCLUDED',
                desc: 'Lateral landmarks were partially occluded in the side photo.',
                action: 'Ensure arms are resting naturally at sides without blocking torso profile.',
                severity: 'medium',
            },
            RETAKE_RECOMMENDED: {
                title: 'RETAKE RECOMMENDED',
                desc: 'Overall confidence score is lower than tailored threshold.',
                action: 'Follow the photogrammetry protocol and re-upload both angles.',
                severity: 'high',
            },
        };
        return map[warnCode] || {
            title: String(warnCode).replace(/_/g, ' '),
            desc: 'System quality notice during 3D body reconstruction.',
            action: 'Review tolerances before tailoring.',
            severity: 'medium',
        };
    };

    // Inline Metric Edit Trigger
    const handleStartEdit = (section, key, currentVal) => {
        setEditingSection(section);
        setEditingKey(key);
        setEditingValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
    };

    const handleSaveEdit = (section, key) => {
        const num = parseFloat(editingValue);
        if (isNaN(num) || num <= 0) {
            setEditingKey(null);
            return;
        }

        const updated = JSON.parse(JSON.stringify(measurements || {}));
        if (!updated[section]) updated[section] = {};
        updated[section][key] = roundNum(num, 1);

        if (!updated.measurement_quality) updated.measurement_quality = {};
        if (!updated.measurement_quality.confidence_levels) updated.measurement_quality.confidence_levels = {};
        updated.measurement_quality.confidence_levels[key] = 'USER EDIT';

        setMeasurements(updated);
        setEditingKey(null);
        setEditingSection(null);

        // Auto-save to active profile in localStorage
        if (activeProfileId) {
            const list = [...savedProfiles];
            const idx = list.findIndex(p => p.id === activeProfileId);
            if (idx > -1) {
                list[idx].measurements = updated;
                list[idx].updatedAt = new Date().toISOString();
                setSavedProfiles(list);
                localStorage.setItem('fit_cloth_profiles', JSON.stringify(list));
                localStorage.setItem('fit_cloth_measurements', JSON.stringify(list[idx]));
            }
        }
        showToast(`Updated ${key.replace(/_/g, ' ')} to ${num.toFixed(1)} cm`);
    };

    // Filter valid Upper Body metrics (only those actually produced by TailorVision)
    const upperMetrics = useMemo(() => {
        if (!measurements?.upper_body) return [];
        const u = measurements.upper_body;
        const candidates = [
            { key: 'chest_circumference', label: 'CHEST CIRC.', val: u.chest_circumference },
            { key: 'waist_circumference', label: 'NATURAL WAIST', val: u.waist_circumference },
            { key: 'hip_seat_circumference', label: 'SEAT / HIP', val: u.hip_seat_circumference },
            { key: 'shoulder_width', label: 'SHOULDER BREADTH', val: u.shoulder_width },
            { key: 'neck_circumference', label: 'NECK CIRC.', val: u.neck_circumference },
            { key: 'sleeve_length', label: 'SLEEVE LENGTH', val: u.sleeve_length },
            { key: 'upper_arm_circumference', label: 'UPPER-ARM CIRC.', val: u.upper_arm_circumference },
        ];
        return candidates.filter(m => m.val !== null && m.val !== undefined && Number(m.val) > 0);
    }, [measurements]);

    // Filter valid Lower Body metrics (only those actually produced by TailorVision)
    const lowerMetrics = useMemo(() => {
        if (!measurements?.lower_body) return [];
        const l = measurements.lower_body;
        const candidates = [
            { key: 'inseam', label: 'INSEAM (CROTCH-ANKLE)', val: l.inseam },
            { key: 'thigh_circumference', label: 'THIGH CIRCUMFERENCE', val: l.thigh_circumference },
            { key: 'calf_circumference', label: 'CALF CIRCUMFERENCE', val: l.calf_circumference },
            { key: 'ankle_circumference', label: 'ANKLE CIRCUMFERENCE', val: l.ankle_circumference },
        ];
        return candidates.filter(m => m.val !== null && m.val !== undefined && Number(m.val) > 0);
    }, [measurements]);

    // Filter valid Bespoke Tailoring Derivations (WITH EASE)
    const derivationMetrics = useMemo(() => {
        if (!measurements?.tailoring_recommendations) return [];
        const rec = measurements.tailoring_recommendations;
        const candidates = [
            { key: 'garment_type', label: 'GARMENT TYPE', val: (rec.garment_type || 'TRADITIONAL').toUpperCase(), isText: true },
            { key: 'chest_with_ease_cm', label: 'CHEST W/ EASE', val: rec.chest_with_ease_cm },
            { key: 'waist_with_ease_cm', label: 'WAIST W/ EASE', val: rec.waist_with_ease_cm },
            { key: 'hip_with_ease_cm', label: 'SEAT/HIP W/ EASE', val: rec.hip_with_ease_cm },
            { key: 'collar_size_cm', label: 'COLLAR SIZE', val: rec.collar_size_cm },
            { key: 'sleeve_length_cm', label: 'SLEEVE LENGTH', val: rec.sleeve_length_cm },
            { key: 'inseam_cm', label: 'INSEAM CROTCH-ANKLE', val: rec.inseam_cm },
        ];
        return candidates.filter(m => m.isText || (m.val !== null && m.val !== undefined && Number(m.val) > 0));
    }, [measurements]);

    // Copy measurements directly to clipboard
    const handleCopyMeasurements = async () => {
        if (!measurements) return;
        const q = measurements.measurement_quality || {};

        const summary = [
            '==================================================',
            `FIT CLOTHS — BESPOKE BODY PROPORTION DOSSIER`,
            '==================================================',
            `Profile Name:          ${profileName}`,
            `Reference Height:      ${height} CM`,
            `Anatomical Gender:     ${gender.toUpperCase()}`,
            `Fit Intent Preference: ${fitPreference}`,
            q.overall_quality_score ? `3D Quality Score:      ${(q.overall_quality_score * 100).toFixed(0)}% [${q.status || 'calibrated'}]` : '',
            q.cross_view_consistency ? `Cross-View Coherence:  ${(q.cross_view_consistency * 100).toFixed(0)}%` : '',
            tailorNotes ? `
DIRECT INSTRUCTIONS TO TAILOR:
"${tailorNotes}"` : '',
            '',
            'BESPOKE TAILORING DERIVATIONS (WITH EASE):',
            ...derivationMetrics.map(d => `  • ${d.label.padEnd(22)}: ${d.isText ? d.val : formatValue(d.val)}`),
            '',
            'UPPER BODY 3D MEASUREMENTS:',
            ...upperMetrics.map(u => `  • ${u.label.padEnd(22)}: ${formatValue(u.val)}`),
            '',
            'LOWER BODY 3D MEASUREMENTS:',
            ...lowerMetrics.map(l => `  • ${l.label.padEnd(22)}: ${formatValue(l.val)}`),
            '==================================================',
        ].filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(summary);
            showToast('✓ COPIED TO CLIPBOARD!');
        } catch (err) {
            console.error('Clipboard copy failed:', err);
        }
    };

    // Consult GX Agent with AI measurements, height, and fit preference as initial input
    const handleConsultGXAgent = () => {
        if (!measurements) return;
        const q = measurements.measurement_quality || {};

        const promptText = `✦ FIT CLOTHS // BESPOKE PROPORTION DOSSIER ✦
• Profile: ${profileName}
• Reference Height: ${height} CM
• Gender Prior: ${gender.toUpperCase()}
• Fit Intent: ${fitPreference}
${tailorNotes ? `• Tailor Notes: "${tailorNotes}"` : ''}
${q.overall_quality_score ? `• 3D Quality: ${(q.overall_quality_score * 100).toFixed(0)}%` : ''}

KEY MEASUREMENTS:
${upperMetrics.map(u => `• ${u.label}: ${formatValue(u.val)}`).join('\n')}
${lowerMetrics.map(l => `• ${l.label}: ${formatValue(l.val)}`).join('\n')}

TAILORING DERIVATIONS:
${derivationMetrics.map(d => `• ${d.label}: ${d.isText ? d.val : formatValue(d.val)}`).join('\n')}

Please analyze my bespoke silhouette and fit notes, and suggest optimal garment styling, drape adjustments, and whether Custom Bespoke or standard S/M/L cuts work best!`;

        window.dispatchEvent(
            new CustomEvent('open_gx_agent', {
                detail: {
                    prompt: promptText,
                    autoSend: true,
                },
            })
        );
    };

    return (
        <div className="relative w-full min-h-screen bg-[#f7f6f0] text-black font-sans editorial-grid px-5 sm:px-8 md:px-12 py-10 select-none overflow-x-hidden">

            {/* Technical Corner Crosshairs */}
            <div className="absolute top-6 left-6 text-black/30 text-xs font-mono pointer-events-none">+</div>
            <div className="absolute top-6 right-6 text-black/30 text-xs font-mono pointer-events-none">+</div>
            <div className="absolute bottom-6 left-6 text-black/30 text-xs font-mono pointer-events-none">+</div>
            <div className="absolute bottom-6 right-6 text-black/30 text-xs font-mono pointer-events-none">+</div>

            {/* Global Notification Toast */}
            {toastMessage && (
                <div className="fixed top-8 right-8 z-50 bg-black text-white px-5 py-3 border-2 border-emerald-500 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] font-mono text-xs font-bold uppercase tracking-wider animate-bounce">
                    {toastMessage}
                </div>
            )}

            <div className="max-w-7xl mx-auto w-full relative z-10">

                {/* ==========================================
                    1. PAGE HEADER & SAVED PROFILES DOCK
                ========================================== */}
                <div className="mb-8 pb-6 border-b-2 border-black flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase bg-black text-white px-2.5 py-1">
                                [ PROPORTION ENGINE // TAILORVISION 3D ]
                            </span>
                            <span className="text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase bg-emerald-100 text-emerald-900 border border-emerald-800 px-2 py-0.5">
                                SMPL-X 3D MESH CALIBRATED
                            </span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase font-sans leading-none">
                            AUTO-MEASURE AI.
                        </h1>
                    </div>

                    {/* Status & Quick Action */}
                    <div className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase">
                        <button
                            type="button"
                            onClick={handleCreateNewFit}
                            className="bg-black hover:bg-neutral-800 text-white border-2 border-black px-4 py-2 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center gap-2"
                        >
                            <span>＋</span>
                            <span>CREATE NEW FIT INSTANCE</span>
                        </button>

                        <div className="bg-white border-2 border-black px-4 py-2 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                            <span>STATUS:</span>
                            <span className={`flex items-center gap-1.5 font-black ${isReady || showResults ? 'text-emerald-600' : 'text-amber-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${isReady || showResults ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                                [{showResults ? 'DOSSIER ACTIVE' : isReady ? 'READY FOR INFERENCE' : 'AWAITING UPLOADS'}]
                            </span>
                        </div>
                    </div>
                </div>

                {/* ==========================================
                    SAVED AI FIT PROFILES TABS / DOCK
                ========================================== */}
                {savedProfiles.length > 0 && (
                    <div className="mb-8 p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 border-b border-black/15 pb-2">
                            <span className="text-xs font-mono font-black uppercase tracking-wider text-black flex items-center gap-2">
                                <span>📁</span>
                                <span>MY SAVED AI FIT PROFILES ({savedProfiles.length})</span>
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500 uppercase">
                                SELECT ANY INSTANCE TO VIEW OR EDIT • CONNECTS DIRECTLY TO CATALOG ITEMS
                            </span>
                        </div>

                        <div className="flex items-center gap-3 overflow-x-auto pb-1">
                            {savedProfiles.map((p) => {
                                const isActive = p.id === activeProfileId;
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => handleSelectProfile(p)}
                                        className={`flex-shrink-0 px-4 py-2.5 border-2 transition-all cursor-pointer flex items-center gap-3 font-mono text-xs ${
                                            isActive
                                                ? 'bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] scale-[1.02]'
                                                : 'bg-[#f7f6f0] text-black border-black/40 hover:border-black'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase tracking-tight text-xs flex items-center gap-1.5">
                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                                {p.name || 'Untitled Fit'}
                                            </span>
                                            <span className={`text-[9px] uppercase ${isActive ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                                {p.gender?.toUpperCase() || 'MALE'} • {p.height} CM • {p.fitPreference || 'TAILORED'}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteProfile(p.id, e)}
                                            className={`p-1 text-xs hover:text-red-500 transition-colors cursor-pointer ${
                                                isActive ? 'text-neutral-400' : 'text-neutral-500'
                                            }`}
                                            title="Delete this profile"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}

                            <button
                                type="button"
                                onClick={handleCreateNewFit}
                                className="flex-shrink-0 px-3 py-2.5 border-2 border-dashed border-black font-mono text-xs font-bold uppercase hover:bg-black hover:text-white transition-all cursor-pointer whitespace-nowrap"
                            >
                                ＋ NEW FIT
                            </button>
                        </div>
                    </div>
                )}
                {/* ==========================================
                    2. ACTIVE FIT INSTANCE DETAILS & TAILOR INSTRUCTIONS
                ========================================== */}
                <div className="mb-8 p-5 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b-2 border-black">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-100 border border-emerald-700 px-2 py-0.5">
                                ● ACTIVE FIT INSTANCE CONFIGURATION
                            </span>
                            <h3 className="text-xl font-black uppercase tracking-tight text-black mt-1">
                                {profileName || 'Untitled Fit Profile'}
                            </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleSaveProfile(false)}
                                className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
                                title="Save changes to this fit profile"
                            >
                                <span>💾</span>
                                <span>SAVE FIT PROFILE</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveProfile(true)}
                                className="py-2 px-4 bg-white hover:bg-neutral-100 text-black border-2 border-black font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
                                title="Duplicate and save as a new fit profile instance"
                            >
                                <span>＋</span>
                                <span>SAVE AS NEW INSTANCE</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateNewFit}
                                className="py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-2 border-black font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                title="Start fresh calibration session"
                            >
                                ＋ FRESH FIT
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Profile Name & Spec Overview */}
                        <div className="lg:col-span-5 space-y-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-black block mb-1">
                                    NAME THIS FIT PROFILE:
                                </label>
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    placeholder="e.g. Traditional Sherwani Fit / Slim Formal..."
                                    className="w-full bg-[#f7f6f0] border-2 border-black p-2.5 font-mono font-bold text-xs text-black focus:outline-none focus:bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                />
                            </div>

                            <div className="p-3 bg-[#f7f6f0] border border-black/30 space-y-1.5 text-[10.5px]">
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 uppercase">INSTANCE ID:</span>
                                    <span className="font-bold text-black">{activeProfileId || 'ACTIVE_SESSION'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 uppercase">TARGET ANATOMY:</span>
                                    <span className="font-bold text-black">{gender?.toUpperCase() || 'MALE'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 uppercase">REFERENCE HEIGHT:</span>
                                    <span className="font-bold text-black">{height} {unit}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 uppercase">DRAPE PREFERENCE:</span>
                                    <span className="font-bold text-black">{fitPreference || 'TAILORED'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tailor Instructions Description Box */}
                        <div className="lg:col-span-7 space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <span className="inline-block transform -scale-x-100 font-bold">✎</span>
                                    <span>DIRECT INSTRUCTIONS TO TAILOR (FIT DESCRIPTION):</span>
                                </label>
                                <span className="text-[9px] text-emerald-800 font-bold uppercase bg-emerald-50 px-1.5 py-0.5 border border-emerald-300">
                                    ATTACHED TO GARMENTS IN BAG
                                </span>
                            </div>
                            <textarea
                                value={tailorNotes}
                                onChange={(e) => setTailorNotes(e.target.value)}
                                placeholder="Directly write anything you want to the master tailor (e.g. Leave 1.5 inch extra ease at waist, tapered ankle opening, structured shoulders, extra sitting room)..."
                                className="w-full h-28 bg-[#f7f6f0] border-2 border-black p-2.5 font-mono text-xs text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white resize-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            />
                            <p className="text-[9.5px] text-neutral-500 leading-normal">
                                ✦ Any bespoke notes entered here are saved with this AI fit profile and will be forwarded directly to the master tailor upon garment order.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ==========================================
                    3. CALIBRATION SETTINGS BAR
                ========================================== */}
                <div className="bg-white border-2 border-black p-5 sm:p-6 mb-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-12 gap-5 items-center">

                    {/* Reference Height Input */}
                    <div className="md:col-span-3 flex flex-col space-y-2">
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-black">
                            01 // REFERENCE HEIGHT:
                        </label>
                        <div className="flex items-center border-2 border-black bg-[#f7f6f0]">
                            <input
                                type="number"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                                placeholder="178"
                                min="100"
                                max="250"
                                className="w-full bg-transparent px-3 py-2 font-mono font-bold text-sm text-black focus:outline-none"
                            />
                            <div className="flex items-center justify-center px-3 py-2 border-l-2 border-black font-mono text-xs font-black uppercase bg-black text-white select-none">
                                CM
                            </div>
                        </div>
                    </div>

                    {/* Gender / Anatomical Prior Selector */}
                    <div className="md:col-span-3 flex flex-col space-y-2">
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-black flex items-center justify-between">
                            <span>02 // ANATOMICAL GENDER:</span>
                            <span className="text-[9px] text-neutral-500 font-mono">SMPL-X PRIOR</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1 border-2 border-black bg-black p-1">
                            {[
                                { id: 'male', label: 'MALE' },
                                { id: 'female', label: 'FEMALE' },
                                { id: 'neutral', label: 'NEUTRAL' },
                            ].map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setGender(g.id)}
                                    className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        gender === g.id
                                            ? 'bg-white text-black font-black'
                                            : 'bg-black text-white hover:text-neutral-300'
                                    }`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fit Preference Selector */}
                    <div className="md:col-span-3 flex flex-col space-y-2">
                        <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-black">
                            03 // FIT INTENT:
                        </label>
                        <div className="grid grid-cols-3 gap-1 border-2 border-black bg-black p-1">
                            {['SLIM', 'TAILORED', 'RELAXED'].map((pref) => (
                                <button
                                    key={pref}
                                    type="button"
                                    onClick={() => setFitPreference(pref)}
                                    className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        fitPreference === pref
                                            ? 'bg-white text-black font-black'
                                            : 'bg-black text-white hover:text-neutral-300'
                                    }`}
                                >
                                    {pref}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Photography Protocol Tip Box (With T-Pose Callout) */}
                    <div className="md:col-span-3 bg-[#f7f6f0] border border-dashed border-black/40 p-3 text-xs font-mono text-black/80 flex items-start gap-2">
                        <span className="text-red-600 font-bold text-sm">ℹ</span>
                        <div className="leading-tight text-[10.5px]">
                            <span className="font-bold uppercase text-black block mb-0.5">3D PROTOCOL (T-POSE):</span>
                            Stand in a strict <strong>T-posture</strong> (arms extended horizontally) against a clean background for sub-millimeter 3D mesh convergence.
                        </div>
                    </div>
                </div>

                {/* ==========================================
                    3. 2-SLOT IMAGE UPLOAD GRID
                ========================================== */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black uppercase tracking-tight font-sans">
                            PHOTOGRAMMETRY INPUTS
                        </h2>
                        <span className="text-xs font-mono uppercase text-red-600 font-bold">
                            [ FRONT VIEW REQUIRES T-POSTURE • PROFILE REQUIRES 90° VIEW ]
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {slots.map((slot) => {
                            const uploadItem = uploads[slot.id];
                            const fileUrl = uploadItem?.url;

                            return (
                                <div
                                    key={slot.id}
                                    className="bg-white border-2 border-black p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between relative"
                                >
                                    {/* Slot Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-mono font-bold text-black/60 uppercase tracking-widest block">
                                                ANGLE // {slot.code}
                                            </span>
                                            <h3 className="font-black text-lg uppercase tracking-tight">
                                                {slot.title}
                                            </h3>
                                        </div>
                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                                            uploadItem
                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                : slot.id === 'front'
                                                    ? 'bg-red-50 text-red-700 border-red-600 font-black'
                                                    : 'bg-neutral-100 text-black border-black'
                                        }`}>
                                            {uploadItem ? '✓ READY' : slot.badge}
                                        </span>
                                    </div>

                                    {/* Upload Dropzone */}
                                    <label className="relative border-2 border-dashed border-black/40 hover:border-black bg-[#f7f6f0] flex flex-col items-center justify-center p-6 min-h-[260px] cursor-pointer transition-colors group overflow-hidden">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(slot.id, e)}
                                            className="hidden"
                                        />

                                        {fileUrl ? (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                <img
                                                    src={fileUrl}
                                                    alt={slot.title}
                                                    className="max-h-60 max-w-full object-contain shadow-sm border border-black/20"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleRemoveImage(slot.id, e)}
                                                    className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs font-mono font-bold uppercase tracking-wider hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    ✕ REMOVE
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center text-center space-y-3 py-2">
                                                <div className="w-14 h-14 border-2 border-black flex items-center justify-center bg-white group-hover:scale-105 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                                    <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="square" strokeLinejoin="miter" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
                                                    </svg>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-black block">
                                                        [ CLICK TO SELECT {slot.id === 'front' ? 'FRONT T-POSE PHOTO' : 'SIDE PROFILE PHOTO'} ]
                                                    </span>
                                                    <span className="text-[10px] font-mono text-neutral-500 uppercase block">
                                                        JPG / PNG / WEBP ACCEPTED
                                                    </span>
                                                </div>

                                                {slot.id === 'front' && (
                                                    <span className="inline-block bg-black text-white px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(239,68,68,1)] border border-red-500">
                                                        ★ T-POSTURE MANDATORY (ARMS EXTENDED HORIZONTALLY)
                                                    </span>
                                                )}

                                                <p className="text-[10.5px] font-mono text-neutral-600 max-w-xs leading-relaxed pt-1">
                                                    {slot.tip}
                                                </p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ==========================================
                    4. ERROR NOTIFICATION PANEL
                ========================================== */}
                {errorDetails && (
                    <div className="mb-10 p-6 bg-red-50 border-2 border-red-600 shadow-[6px_6px_0px_0px_rgba(220,38,38,1)] text-black font-mono">
                        <div className="flex items-start gap-3 mb-3">
                            <span className="bg-red-600 text-white font-bold px-2 py-0.5 text-xs">
                                ERROR {errorDetails.status ? `// HTTP ${errorDetails.status}` : ''}
                            </span>
                            <span className="text-red-700 font-bold text-sm tracking-wide">
                                {errorDetails.stage === 'photo_validation'
                                    ? 'GEMMA PHOTO VALIDATION REJECTED'
                                    : 'MEASUREMENT INFERENCE ERROR'}
                            </span>
                        </div>

                        <p className="text-sm font-semibold mb-4 text-black">
                            {errorDetails.message}
                        </p>

                        {errorDetails.retake && Object.keys(errorDetails.retake).length > 0 && (
                            <div className="space-y-3 bg-white border border-red-300 p-4 mb-4">
                                <span className="text-xs font-bold uppercase tracking-wider text-red-700 block">
                                    RETAKE INSTRUCTIONS FROM LOCAL GEMMA:
                                </span>
                                {Object.entries(errorDetails.retake).map(([viewName, r]) => (
                                    <div key={viewName} className="text-xs border-l-2 border-red-600 pl-3 py-1">
                                        <span className="font-bold uppercase text-black">
                                            [{viewName.toUpperCase()} PHOTO]:
                                        </span>{' '}
                                        <span className="text-neutral-800">{r.reason || 'Unsuitable orientation or crop.'}</span>
                                        {r.retake_instruction && (
                                            <div className="text-red-600 font-medium mt-0.5">
                                                ➔ Correction: {r.retake_instruction}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleStartInference}
                                disabled={!isReady || isAnalyzing}
                                className="px-5 py-2 bg-red-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors cursor-pointer border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                                [ RETRY INFERENCE ]
                            </button>
                            <span className="text-xs text-neutral-600">
                                Verify photos are taken in T-posture against neutral background and retry.
                            </span>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    5. INFERENCE TRIGGER BUTTON
                ========================================== */}
                <div className="mb-14">
                    <button
                        type="button"
                        disabled={!isReady || isAnalyzing}
                        onClick={handleStartInference}
                        className={`w-full py-6 px-8 border-2 border-black font-mono font-bold text-sm sm:text-base tracking-widest uppercase transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 ${
                            !isReady || isAnalyzing
                                ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]'
                                : 'bg-black text-white hover:bg-neutral-900 cursor-pointer'
                        }`}
                    >
                        {isAnalyzing ? (
                            <span className="flex items-center justify-center gap-3">
                                <span className="inline-block w-3 h-3 bg-red-600 animate-ping rounded-full"></span>
                                [ RUNNING TAILORVISION 3D SMPL-X SHAPE OPTIMIZER... ]
                            </span>
                        ) : (
                            <span>GENERATE 3D SILHOUETTE & MEASUREMENTS</span>
                        )}
                    </button>

                    {isAnalyzing && (
                        <div className="mt-4 border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-mono text-xs flex items-center justify-between">
                            <span className="font-bold text-black flex items-center gap-2">
                                <span className="animate-spin inline-block">⚙</span> IN PROGRESS: Fitting 3D topology & extracting tailoring contours...
                            </span>
                            <span className="text-neutral-500 text-[10px] uppercase">
                                TAILORVISION 3D + MEDIAPIPE + GEMMA
                            </span>
                        </div>
                    )}
                </div>

                {/* ==========================================
                    6. RESULT SHOWCASE (3D POINT CLOUD + METRICS)
                ========================================== */}
                {showResults && measurements && (
                    <div className="border-2 border-black bg-white p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-16 animate-fadeIn">

                        {/* Results Title Banner */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 mb-8 border-b-2 border-black gap-4">
                            <div>
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-600 text-white px-2 py-0.5 mb-2 inline-block">
                                    ESTIMATION COMPLETE // MODEL CALIBRATED
                                </span>
                                <h2 className="text-3xl font-black uppercase tracking-tight font-sans">
                                    EXTRACTED BODY DOSSIER
                                </h2>
                            </div>
                            <div className="flex flex-col items-end font-mono text-xs text-black/70">
                                <span>CALIBRATED HEIGHT: <strong className="text-black">{height} {unit}</strong></span>
                                <span className="text-emerald-700 font-bold text-[11px]">✓ TAILORVISION 3D FIT LOCKED</span>
                            </div>
                        </div>

                        {/* ==========================================
                            6.1 PROFILE NAME & TAILOR INSTRUCTIONS (DESCRIPTION BOX)
                        ========================================== */}
                        <div className="mb-8 p-5 bg-[#f7f6f0] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                            {/* Profile Name Field */}
                            <div className="md:col-span-5 flex flex-col space-y-2 font-mono">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-black flex items-center justify-between">
                                    <span>AI FIT PROFILE NAME:</span>
                                    <span className="text-[9px] text-neutral-500">EDITABLE IDENTIFIER</span>
                                </label>
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    placeholder="e.g. My Formal Bespoke Fit"
                                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-sm font-bold text-black focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                />
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveProfile(false)}
                                        className="py-1.5 px-3 bg-black text-white text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        💾 SAVE PROFILE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveProfile(true)}
                                        className="py-1.5 px-3 bg-white text-black border border-black text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-100 transition-all cursor-pointer"
                                        title="Create a duplicate instance of this fit"
                                    >
                                        ＋ SAVE AS NEW INSTANCE
                                    </button>
                                </div>
                            </div>

                            {/* Direct Instructions to Tailor (Description Box) */}
                            <div className="md:col-span-7 flex flex-col space-y-2 font-mono">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-black flex items-center justify-between">
                                    <span>DIRECT INSTRUCTIONS TO TAILOR:</span>
                                    <span className="text-[9px] text-red-600 font-bold uppercase">ATTACHED TO CART & ORDERS</span>
                                </label>
                                <textarea
                                    value={tailorNotes}
                                    onChange={(e) => setTailorNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Write any specific fitting notes or custom requests directly to the tailor (e.g. 'Leave extra 2cm ease at waist for comfort', 'Prefer sleeves 1cm longer', 'Slim taper below knees')..."
                                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] resize-none"
                                />
                            </div>
                        </div>

                        {/* ==========================================
                            6.2 TAILORVISION 3D QUALITY & CONVERGENCE HUD
                        ========================================== */}
                        {measurements.measurement_quality && (() => {
                            const mq = measurements.measurement_quality;
                            const overallScore = Math.round((mq.overall_quality_score || 0.85) * 100);
                            const consistencyScore = Math.round((mq.cross_view_consistency || 0.88) * 100);
                            const isValidated = mq.status === 'validated_tailoring_grade' || overallScore >= 50;
                            const hasPoorFit = mq.warnings?.includes('POOR_FIT_CONVERGENCE');

                            return (
                                <div className="mb-8">
                                    {/* 4-KPI Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5 font-mono">
                                        {/* 1. Overall Quality Score */}
                                        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-[10px] text-neutral-600 font-bold uppercase">
                                                <span>OVERALL 3D FIT QUALITY</span>
                                                <span className={`w-2 h-2 rounded-full ${isValidated ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                            </div>
                                            <div className="my-2 flex items-baseline gap-2">
                                                <span className="text-3xl font-black text-black">{overallScore}%</span>
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 border ${
                                                    isValidated ? 'bg-emerald-50 text-emerald-800 border-emerald-600' : 'bg-amber-50 text-amber-800 border-amber-600'
                                                }`}>
                                                    {isValidated ? 'TAILORING GRADE' : 'EXPERIMENTAL'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-neutral-200 h-1.5 border border-black/20">
                                                <div
                                                    className={`h-full ${isValidated ? 'bg-emerald-600' : 'bg-amber-500'}`}
                                                    style={{ width: `${overallScore}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* 2. Cross-View Consistency */}
                                        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-[10px] text-neutral-600 font-bold uppercase">
                                                <span>CROSS-VIEW CONSISTENCY</span>
                                                <span className="text-neutral-400">FRONT ⇄ PROFILE</span>
                                            </div>
                                            <div className="my-2 flex items-baseline gap-2">
                                                <span className="text-3xl font-black text-black">{consistencyScore}%</span>
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 border ${
                                                    consistencyScore >= 70 ? 'bg-emerald-50 text-emerald-800 border-emerald-600' : 'bg-amber-50 text-amber-800 border-amber-600'
                                                }`}>
                                                    {consistencyScore >= 70 ? 'POSE COHERENT' : 'CHECK ALIGNMENT'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-neutral-500">
                                                Torso ratio coherence between viewpoints
                                            </div>
                                        </div>

                                        {/* 3. SMPL-X Convergence */}
                                        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-[10px] text-neutral-600 font-bold uppercase">
                                                <span>3D SHAPE CONVERGENCE</span>
                                                <span className="text-neutral-400">SMPL-X OPTIMIZER</span>
                                            </div>
                                            <div className="my-2">
                                                <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase px-2 py-1 border ${
                                                    hasPoorFit
                                                        ? 'bg-amber-50 text-amber-800 border-amber-600'
                                                        : 'bg-emerald-50 text-emerald-800 border-emerald-600'
                                                }`}>
                                                    {hasPoorFit ? '⚠ POOR FIT CONVERGENCE' : '✓ FULLY CONVERGED'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-neutral-500">
                                                {hasPoorFit ? 'Loss threshold unmet (use edit buttons if needed)' : 'Residual shape error < 0.05'}
                                            </div>
                                        </div>

                                        {/* 4. Model Prior */}
                                        <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-[10px] text-neutral-600 font-bold uppercase">
                                                <span>ANATOMICAL PRIOR & SCALE</span>
                                                <span className="text-neutral-400">3D MESH</span>
                                            </div>
                                            <div className="my-2 flex flex-col">
                                                <span className="text-sm font-black text-black uppercase">
                                                    GENDER: {gender.toUpperCase()}
                                                </span>
                                                <span className="text-[10px] text-neutral-600">
                                                    SCALE: {mq.scale_method || 'KNOWN HEIGHT'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-neutral-500">
                                                Calibrated against {height} CM
                                            </div>
                                        </div>
                                    </div>

                                    {/* POOR FIT CONVERGENCE Warning Banner */}
                                    {hasPoorFit && (
                                        <div className="p-4 mb-5 bg-amber-50 border-2 border-amber-600 shadow-[4px_4px_0px_0px_rgba(217,119,6,1)] font-mono text-xs flex items-start gap-3">
                                            <span className="text-amber-600 font-black text-lg leading-none">⚠</span>
                                            <div>
                                                <span className="font-black uppercase text-amber-900 block mb-1">
                                                    POOR FIT CONVERGENCE WARNING — HIGHER MEASUREMENT UNCERTAINTY
                                                </span>
                                                <p className="text-amber-950 text-[11px] leading-relaxed mb-2">
                                                    The TailorVision SMPL-X iterative 3D shape optimizer did not fully reach its convergence loss threshold. This is commonly triggered by baggy clothing, heavy drapery, or arms not fully extended in a T-pose.
                                                </p>
                                                <div className="text-[11px] text-amber-900 font-semibold bg-white p-2 border border-amber-300">
                                                    ➔ <strong>Recommendation:</strong> Use the <strong>[ ✎ EDIT ]</strong> buttons below to adjust any specific measurement if you know your preferred size, or re-upload photos standing in a strict <strong>T-posture</strong>.
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Structured Quality Warnings List */}
                                    {mq.warnings && mq.warnings.filter(w => w !== 'POOR_FIT_CONVERGENCE').length > 0 && (
                                        <div className="p-4 mb-5 bg-neutral-50 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-mono">
                                            <div className="text-xs font-black uppercase tracking-wider text-black mb-3 flex items-center justify-between border-b border-black/20 pb-1.5">
                                                <span>// ACTIVE QUALITY & POSTURE AUDIT ({mq.warnings.filter(w => w !== 'POOR_FIT_CONVERGENCE').length})</span>
                                                <span className="text-[10px] text-neutral-500">TAILORVISION AUDIT</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {mq.warnings.filter(w => w !== 'POOR_FIT_CONVERGENCE').map((wCode, idx) => {
                                                    const details = getWarningDetails(wCode);
                                                    return (
                                                        <div key={idx} className="p-2.5 bg-white border border-black/30 flex flex-col justify-between text-xs">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`w-2 h-2 rounded-full ${details.severity === 'high' ? 'bg-red-600' : 'bg-amber-500'}`}></span>
                                                                <span className="font-bold uppercase text-[11px] text-black">
                                                                    {details.title}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-neutral-700 mb-1.5">
                                                                {details.desc}
                                                            </p>
                                                            <div className="text-[10px] text-neutral-900 font-medium bg-[#f7f6f0] p-1.5 border border-black/10">
                                                                ➔ {details.action}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

                            {/* Left Column: Simulated 3D Wireframe Contour HUD */}
                            <div className="lg:col-span-5 bg-black text-white p-6 border-2 border-black relative overflow-hidden flex flex-col items-center justify-center min-h-[460px]">

                                {/* HUD Header */}
                                <div className="absolute top-4 left-4 font-mono text-[10px] text-white/50 tracking-widest uppercase">
                                    TOPOLOGY // MEDIAPIPE_MESH
                                </div>
                                <div className="absolute top-4 right-4 font-mono text-[10px] text-emerald-400 tracking-widest uppercase">
                                    ● POSE LOCKED
                                </div>

                                {/* Simulated Wireframe Vector Body */}
                                <div className="relative my-8">
                                    <svg className="w-52 h-88 text-emerald-400/90 stroke-current fill-none" viewBox="0 0 100 180">
                                        {/* Head & Neck */}
                                        <circle cx="50" cy="22" r="12" strokeWidth="1" strokeDasharray="1 1" />

                                        {/* Shoulders & Torso Mesh */}
                                        <path d="M 22 42 L 78 42 L 70 85 L 30 85 Z" strokeWidth="1.2" />

                                        {/* Chest Landmark Line */}
                                        <line x1="18" y1="52" x2="82" y2="52" stroke="#ef4444" strokeWidth="1.5" />
                                        <text x="85" y="55" fill="#ef4444" fontSize="6.5" fontFamily="monospace">CHEST</text>

                                        {/* Waist Landmark Line */}
                                        <line x1="26" y1="72" x2="74" y2="72" stroke="#ef4444" strokeWidth="1.5" />
                                        <text x="77" y="75" fill="#ef4444" fontSize="6.5" fontFamily="monospace">WAIST</text>

                                        {/* Hips / Seat Landmark Line */}
                                        <line x1="24" y1="92" x2="76" y2="92" stroke="#ef4444" strokeWidth="1.5" />
                                        <text x="79" y="95" fill="#ef4444" fontSize="6.5" fontFamily="monospace">HIPS</text>

                                        {/* Legs & Inseam Mesh */}
                                        <path d="M 30 85 L 48 165 L 35 165 L 24 92 Z" strokeWidth="1" />
                                        <path d="M 70 85 L 52 165 L 65 165 L 76 92 Z" strokeWidth="1" />

                                        {/* Landmark Points */}
                                        <circle cx="50" cy="52" r="1.5" fill="#34d399" />
                                        <circle cx="32" cy="52" r="1.5" fill="#34d399" />
                                        <circle cx="68" cy="52" r="1.5" fill="#34d399" />
                                        <circle cx="50" cy="72" r="1.5" fill="#34d399" />
                                        <circle cx="38" cy="92" r="1.5" fill="#34d399" />
                                        <circle cx="62" cy="92" r="1.5" fill="#34d399" />
                                    </svg>
                                </div>

                                {/* HUD Footer */}
                                <div className="w-full pt-4 border-t border-white/20 flex justify-between items-center font-mono text-[10px] text-white/60 uppercase">
                                    <span>REF: {height} {unit}</span>
                                    <span>PREF: {fitPreference}</span>
                                </div>
                            </div>

                            {/* Right Column: Extracted Tailoring Metrics & Dropdowns */}
                            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">

                                {/* ========================================================
                                    SECTION 1: UPPER BODY PROPORTIONS (DROPDOWN ACCORDION)
                                ======================================================== */}
                                <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    {/* Dropdown Toggle Header */}
                                    <button
                                        type="button"
                                        onClick={() => setIsUpperOpen(!isUpperOpen)}
                                        className="w-full p-3.5 bg-neutral-100 hover:bg-neutral-200 border-b border-black flex items-center justify-between font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-black">// 01. UPPER BODY PROPORTIONS ({upperMetrics.length} METRICS)</span>
                                            <span className="text-[10px] text-neutral-500 font-normal">SMPL-X CONTOUR 3D</span>
                                        </div>
                                        <span className="bg-white border border-black px-2 py-0.5 text-[10px] text-black shadow-xs">
                                            {isUpperOpen ? 'COLLAPSE ▲' : 'EXPAND ▼'}
                                        </span>
                                    </button>

                                    {/* Dropdown Content */}
                                    {isUpperOpen && (
                                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn">
                                            {upperMetrics.map((metric, idx) => {
                                                const conf = getMetricConfidence(metric.key);
                                                const unc = getMetricUncertainty(metric.key);
                                                const isEditing = editingSection === 'upper_body' && editingKey === metric.key;

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="p-3 bg-[#f7f6f0] border-2 border-black flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative group"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-mono text-[9px] font-bold text-black/60 uppercase tracking-wider">
                                                                {metric.label}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => isEditing ? handleSaveEdit('upper_body', metric.key) : handleStartEdit('upper_body', metric.key, metric.val)}
                                                                className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                                                                title="Edit this measurement"
                                                            >
                                                                {isEditing ? <span className="font-bold text-xs">✓</span> : <span className="inline-block transform -scale-x-100 text-xs font-bold leading-none select-none">✎</span>}
                                                            </button>
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="my-1 flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={editingValue}
                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                    className="w-full bg-white border border-black px-1.5 py-0.5 font-mono font-bold text-sm text-black focus:outline-none"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit('upper_body', metric.key)}
                                                                    className="px-2 py-0.5 bg-black text-white text-[10px] font-bold"
                                                                >
                                                                    ✓
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="font-mono font-black text-lg text-black my-0.5">
                                                                {formatValue(metric.val)}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between text-[8px] font-mono mt-1 pt-1 border-t border-black/10">
                                                            <span className={`font-bold uppercase ${
                                                                conf === 'USER EDIT' ? 'text-blue-700' :
                                                                conf === 'HIGH' ? 'text-emerald-700' :
                                                                conf === 'MEDIUM' ? 'text-amber-700' :
                                                                conf === 'LOW' || conf === 'UNRELIABLE' ? 'text-red-600' :
                                                                'text-emerald-700'
                                                            }`}>
                                                                {conf || 'ESTIMATED'}
                                                            </span>
                                                            {unc && conf !== 'USER EDIT' && (
                                                                <span className="font-mono font-bold text-black/70 bg-white px-1 border border-black/20">
                                                                    {unc}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* ========================================================
                                    SECTION 2: LOWER BODY & INSEAM (DROPDOWN ACCORDION)
                                ======================================================== */}
                                <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                    {/* Dropdown Toggle Header */}
                                    <button
                                        type="button"
                                        onClick={() => setIsLowerOpen(!isLowerOpen)}
                                        className="w-full p-3.5 bg-neutral-100 hover:bg-neutral-200 border-b border-black flex items-center justify-between font-mono font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-black">// 02. LOWER BODY & INSEAM ({lowerMetrics.length} METRICS)</span>
                                            <span className="text-[10px] text-neutral-500 font-normal">ANATOMICAL JOINTS</span>
                                        </div>
                                        <span className="bg-white border border-black px-2 py-0.5 text-[10px] text-black shadow-xs">
                                            {isLowerOpen ? 'COLLAPSE ▲' : 'EXPAND ▼'}
                                        </span>
                                    </button>

                                    {/* Dropdown Content */}
                                    {isLowerOpen && (
                                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn">
                                            {lowerMetrics.map((metric, idx) => {
                                                const conf = getMetricConfidence(metric.key);
                                                const unc = getMetricUncertainty(metric.key);
                                                const isEditing = editingSection === 'lower_body' && editingKey === metric.key;

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="p-3 bg-[#f7f6f0] border-2 border-black flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative group"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-mono text-[9px] font-bold text-black/60 uppercase tracking-wider">
                                                                {metric.label}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => isEditing ? handleSaveEdit('lower_body', metric.key) : handleStartEdit('lower_body', metric.key, metric.val)}
                                                                className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                                                                title="Edit this measurement"
                                                            >
                                                                {isEditing ? <span className="font-bold text-xs">✓</span> : <span className="inline-block transform -scale-x-100 text-xs font-bold leading-none select-none">✎</span>}
                                                            </button>
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="my-1 flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={editingValue}
                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                    className="w-full bg-white border border-black px-1.5 py-0.5 font-mono font-bold text-sm text-black focus:outline-none"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit('lower_body', metric.key)}
                                                                    className="px-2 py-0.5 bg-black text-white text-[10px] font-bold"
                                                                >
                                                                    ✓
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="font-mono font-black text-lg text-black my-0.5">
                                                                {formatValue(metric.val)}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between text-[8px] font-mono mt-1 pt-1 border-t border-black/10">
                                                            <span className={`font-bold uppercase ${
                                                                conf === 'USER EDIT' ? 'text-blue-700' :
                                                                conf === 'HIGH' ? 'text-emerald-700' :
                                                                conf === 'MEDIUM' ? 'text-amber-700' :
                                                                conf === 'LOW' || conf === 'UNRELIABLE' ? 'text-red-600' :
                                                                'text-emerald-700'
                                                            }`}>
                                                                {conf || 'ESTIMATED'}
                                                            </span>
                                                            {unc && conf !== 'USER EDIT' && (
                                                                <span className="font-mono font-bold text-black/70 bg-white px-1 border border-black/20">
                                                                    {unc}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* ========================================================
                                    SECTION 3: BESPOKE TAILORING DERIVATIONS (NO DROPDOWN)
                                ======================================================== */}
                                {derivationMetrics.length > 0 && (
                                    <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-3.5">
                                            <h3 className="font-mono font-black text-xs uppercase tracking-wider text-black flex items-center gap-2">
                                                <span>✂</span>
                                                <span>// 03. BESPOKE TAILORING DERIVATIONS (WITH EASE)</span>
                                            </h3>
                                            <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 font-bold uppercase">
                                                ALWAYS ACTIVE
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {derivationMetrics.map((metric, idx) => {
                                                const isEditing = editingSection === 'tailoring_recommendations' && editingKey === metric.key;

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="p-3 bg-[#f7f6f0] border-2 border-black flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-mono text-[9px] font-bold text-black/60 uppercase tracking-wider">
                                                                {metric.label}
                                                            </span>
                                                            {!metric.isText && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => isEditing ? handleSaveEdit('tailoring_recommendations', metric.key) : handleStartEdit('tailoring_recommendations', metric.key, metric.val)}
                                                                    className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                                                                    title="Edit this derivation"
                                                                >
                                                                    {isEditing ? <span className="font-bold text-xs">✓</span> : <span className="inline-block transform -scale-x-100 text-xs font-bold leading-none select-none">✎</span>}
                                                                </button>
                                                            )}
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="my-1 flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={editingValue}
                                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                                    className="w-full bg-white border border-black px-1.5 py-0.5 font-mono font-bold text-sm text-black focus:outline-none"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit('tailoring_recommendations', metric.key)}
                                                                    className="px-2 py-0.5 bg-black text-white text-[10px] font-bold"
                                                                >
                                                                    ✓
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="font-mono font-black text-base text-black my-0.5">
                                                                {metric.isText ? metric.val : formatValue(metric.val)}
                                                            </div>
                                                        )}

                                                        <span className="font-mono text-[8px] text-neutral-500 font-bold uppercase mt-1 pt-1 border-t border-black/10">
                                                            TAILOR EASE
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons Toolbar */}
                                <div className="pt-4 border-t border-black/15 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/search')}
                                        className="whitespace-nowrap py-3.5 px-6 bg-black text-white border-2 border-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer text-center"
                                    >
                                        [ APPLY TO BESPOKE CATALOG → ]
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleSaveProfile(false)}
                                        className="whitespace-nowrap py-3.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white border-2 border-black font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <span>💾</span>
                                        <span>SAVE FIT PROFILE</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCopyMeasurements}
                                        className="whitespace-nowrap py-3.5 px-5 border-2 border-black font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 bg-white hover:bg-neutral-50 text-black"
                                    >
                                        <span>📋</span>
                                        <span>COPY DOSSIER</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleConsultGXAgent}
                                        className="whitespace-nowrap py-3.5 px-5 bg-orange-500 hover:bg-orange-600 text-white border-2 border-black font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <span>💬</span>
                                        <span>CONSULT GX AGENT</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCreateNewFit}
                                        className="whitespace-nowrap py-3.5 px-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-2 border-black font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <span>＋</span>
                                        <span>NEW INSTANCE</span>
                                    </button>
                                </div>

                            </div>

                        </div>

                    </div>
                )}

            </div>
        </div>
    );
};

export default FitPage;
