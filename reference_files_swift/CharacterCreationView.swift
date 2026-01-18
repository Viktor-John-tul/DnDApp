import SwiftUI
import SwiftData
import PhotosUI
import UIKit

struct CharacterCreationView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    
    var isDemonSlayerMode: Bool
    
    // Standard inputs
    @State private var name = ""
    @State private var characterClass = ""
    @State private var level = 1
    
    // Stats
    @State private var strength = 10
    @State private var dexterity = 10
    @State private var constitution = 10
    @State private var intelligence = 10
    @State private var wisdom = 10
    @State private var charisma = 10
    @State private var selectedSkills: [String] = []
    
    // NEW: Breathing Logic
    @State private var breathingStyleName = ""
    @State private var numberOfForms = 1
    // We initialize with 1 empty form struct
    @State private var breathingForms: [BreathingForm] = [BreathingForm(name: "First Form")]
    
    // Logic for editing a specific form
    @State private var formToEdit: BreathingForm? // If this is set, the sheet opens
    
    // Image
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var selectedPhotoData: Data?

    // Math
    var pointsSpent: Int { (strength - 10) + (dexterity - 10) + (constitution - 10) + (intelligence - 10) + (wisdom - 10) + (charisma - 10) }
    var pointsRemaining: Int { (9 + level) - pointsSpent }
    
    // Lists & Grids
    let allSkills = [
        "Acrobatics (Dex)", "Animal Handling (Wis)", "Arcana (Int)", "Athletics (Str)",
        "Deception (Cha)", "History (Int)", "Insight (Wis)", "Intimidation (Cha)",
        "Investigation (Int)", "Medicine (Wis)", "Nature (Int)", "Perception (Wis)",
        "Performance (Cha)", "Persuasion (Cha)", "Religion (Int)", "Sleight of Hand (Dex)",
        "Stealth (Dex)", "Survival (Wis)"
    ]
    
    let twoColumns = [GridItem(.flexible()), GridItem(.flexible())]
    let threeColumns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Name", text: $name)
                    TextField(isDemonSlayerMode ? "Rank" : "Class", text: $characterClass)
                    Stepper("Level: \(level)", value: $level, in: 1...20)
                }
                
                Section("Stats") {
                    HStack { Text("Points Left:"); Spacer(); Text("\(pointsRemaining)").bold().foregroundStyle(pointsRemaining == 0 ? .green : .orange) }
                    LazyVGrid(columns: threeColumns, spacing: 10) {
                        StatCard(title: "STR", value: $strength, pointsRemaining: pointsRemaining)
                        StatCard(title: "DEX", value: $dexterity, pointsRemaining: pointsRemaining)
                        StatCard(title: "CON", value: $constitution, pointsRemaining: pointsRemaining)
                        StatCard(title: "INT", value: $intelligence, pointsRemaining: pointsRemaining)
                        StatCard(title: "WIS", value: $wisdom, pointsRemaining: pointsRemaining)
                        StatCard(title: "CHA", value: $charisma, pointsRemaining: pointsRemaining)
                    }
                }
                
                Section("Skills (Pick 2)") {
                    LazyVGrid(columns: twoColumns, spacing: 10) {
                        ForEach(allSkills, id: \.self) { skill in
                            SkillButton(name: skill, isSelected: selectedSkills.contains(skill)) {
                                if selectedSkills.contains(skill) { selectedSkills.removeAll { $0 == skill } }
                                else if selectedSkills.count < 2 { selectedSkills.append(skill) }
                            }
                        }
                    }
                }
                
                Section("Visuals") {
                    PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                        Label(selectedPhotoData == nil ? "Select Photo" : "Photo Selected", systemImage: "photo")
                    }
                }
                
                // --- BREATHING SECTION ---
                if isDemonSlayerMode {
                    Section(header: Text("Breathing Technique")) {
                        TextField("Style Name (e.g. Flame Breathing)", text: $breathingStyleName)
                        
                        Stepper(value: $numberOfForms, in: 1...15) {
                            HStack {
                                Text("Total Forms:")
                                Spacer()
                                Text("\(numberOfForms)").bold().foregroundStyle(.orange)
                            }
                        }
                        .onChange(of: numberOfForms) { adjustFormArray() }
                        
                        // THE GRID OF FORMS
                        LazyVGrid(columns: twoColumns, spacing: 15) {
                            ForEach(breathingForms.indices, id: \.self) { index in
                                Button(action: {
                                    // Open the editor for this specific form
                                    formToEdit = breathingForms[index]
                                }) {
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text("Form \(index + 1)")
                                            .font(.caption)
                                            .bold()
                                            .foregroundStyle(.orange)
                                        
                                        Text(breathingForms[index].name.isEmpty ? "Tap to Edit" : breathingForms[index].name)
                                            .font(.headline)
                                            .foregroundStyle(.primary)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                        
                                        // Small badge for effect
                                        Text(breathingForms[index].effectType.rawValue)
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.gray.opacity(0.2))
                                            .cornerRadius(4)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .frame(height: 100)
                                    .background(Color(UIColor.secondarySystemGroupedBackground))
                                    .cornerRadius(12)
                                    .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
            .navigationTitle(isDemonSlayerMode ? "New Slayer" : "New Adventurer")
            .toolbar {
                Button("Save") { saveCharacter() }
                .disabled(name.isEmpty || pointsRemaining < 0 || selectedSkills.count != 2)
            }
            .onChange(of: selectedPhotoItem) {
                Task {
                    if let data = try? await selectedPhotoItem?.loadTransferable(type: Data.self) { selectedPhotoData = data }
                }
            }
            // THIS HANDLES THE POP-UP EDITOR
            .sheet(item: $formToEdit) { form in
                // We find the index of the form being edited to bind it back to the array
                if let index = breathingForms.firstIndex(where: { $0.id == form.id }) {
                    BreathingFormEditor(form: $breathingForms[index])
                        .presentationDetents([.medium]) // Makes it a half-height sheet
                }
            }
        }
    }
    
    // Keep array size matching stepper
    func adjustFormArray() {
        if numberOfForms > breathingForms.count {
            let diff = numberOfForms - breathingForms.count
            for _ in 0..<diff { breathingForms.append(BreathingForm()) }
        } else if numberOfForms < breathingForms.count {
            breathingForms.removeLast(breathingForms.count - numberOfForms)
        }
    }
    
    func saveCharacter() {
        let newChar = RPGCharacter(name: name, characterClass: characterClass, level: level)
        newChar.strength = strength; newChar.dexterity = dexterity; newChar.constitution = constitution
        newChar.intelligence = intelligence; newChar.wisdom = wisdom; newChar.charisma = charisma
        newChar.proficientSkills = selectedSkills
        newChar.photoData = selectedPhotoData
        
        if isDemonSlayerMode {
            newChar.isSpecialRuleEnabled = true
            newChar.breathingStyleName = breathingStyleName
            newChar.breathingForms = breathingForms // Saves the whole complex array
        }
        
        modelContext.insert(newChar)
        dismiss()
    }
}

// MARK: - MISSING HELPERS

// 1. Skill Button
struct SkillButton: View {
    let name: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                let components = name.components(separatedBy: " (")
                let skillName = components.first ?? name
                let attribute = components.count > 1 ? "(\(components.last!)" : ""
                
                Text(skillName)
                    .font(.subheadline)
                    .fontWeight(isSelected ? .bold : .medium)
                    .foregroundStyle(isSelected ? .orange : .primary)
                Text(attribute)
                    .font(.caption2)
                    .foregroundStyle(isSelected ? .orange.opacity(0.8) : .secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.orange : Color.gray.opacity(0.3), lineWidth: isSelected ? 2 : 1)
                    .background(isSelected ? Color.orange.opacity(0.1) : Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// 2. Stat Card
struct StatCard: View {
    let title: String
    @Binding var value: Int
    var pointsRemaining: Int
    
    var body: some View {
        VStack(spacing: 12) {
            Text(title).font(.subheadline).fontWeight(.bold).foregroundStyle(.secondary).padding(.top, 5)
            Text("\(value)")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(value > 10 ? .blue : .primary)
            Spacer(minLength: 0)
            HStack(spacing: 15) {
                Button(action: { if value > 10 { value -= 1 } }) {
                    ZStack {
                        Circle().fill(value > 10 ? Color.red.opacity(0.8) : Color.gray.opacity(0.2))
                        Image(systemName: "minus").font(.system(size: 14, weight: .bold)).foregroundStyle(value > 10 ? .white : .gray)
                    }
                    .frame(width: 32, height: 32)
                }
                .disabled(value <= 10)
                .buttonStyle(PlainButtonStyle())
                
                Button(action: { if pointsRemaining > 0 { value += 1 } }) {
                    ZStack {
                        Circle().fill(pointsRemaining > 0 ? Color.green.opacity(0.8) : Color.gray.opacity(0.2))
                        Image(systemName: "plus").font(.system(size: 14, weight: .bold)).foregroundStyle(pointsRemaining > 0 ? .white : .gray)
                    }
                    .frame(width: 32, height: 32)
                }
                .disabled(pointsRemaining <= 0)
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.bottom, 10)
        }
        .frame(height: 140).frame(maxWidth: .infinity)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 3, x: 0, y: 2)
    }
}
