import { Component, signal } from '@angular/core';
import { GeminiService, type GeminiAnalysisResult } from './gemini.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Clasificador de Enfermedades de Papa');
  protected selectedImage = signal<string | null>(null);

  protected isAnalyzing = signal(false);
  protected analysisResult = signal<GeminiAnalysisResult | null>(null);
  protected analysisError = signal<string | null>(null);

  constructor(private readonly gemini: GeminiService) {}

  onCameraClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => this.handleImageSelect(e);
    input.click();
  }

  onGalleryClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.handleImageSelect(e);
    input.click();
  }

  private handleImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        this.selectedImage.set(dataUrl);
        this.analyzeImage(dataUrl);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  private async analyzeImage(dataUrl: string): Promise<void> {
    this.isAnalyzing.set(true);
    this.analysisResult.set(null);
    this.analysisError.set(null);

    try {
      const result = await this.gemini.analyzeImage(dataUrl);
      this.analysisResult.set(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error analizando la imagen';
      this.analysisError.set(message);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  getResultColor(): string {
    const label = this.analysisResult()?.label?.toLowerCase() ?? '';
    if (label.includes('saludable')) return '#4ade80';
    if (label.includes('temprano')) return '#fbbf24';
    if (label.includes('tardío') || label.includes('tardio')) return '#f87171';
    return '#87CEEB';
  }

  getConfidencePercent(): number {
    return Math.round((this.analysisResult()?.confidence ?? 0) * 100);
  }
}
